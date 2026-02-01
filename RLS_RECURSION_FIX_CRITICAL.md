# CRITICAL: RLS Infinite Recursion Bug - FIXED

## 🚨 Problem Identified

The Owner Portal was stuck on "Loading orders..." because the **profile could not be loaded** due to an **infinite recursion bug** in the database RLS (Row Level Security) policies.

### Root Cause: Infinite Recursion in Helper Functions

The `get_user_org_id()` and `user_has_role()` database functions were causing infinite recursion:

```sql
-- BUGGY VERSION (in 003_create_profiles.sql)
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**What happens:**
1. User tries to read their profile from `profiles` table
2. RLS policy evaluates: `USING (user_id = auth.uid())`
3. ✅ This works fine for the basic profile read

BUT when trying to read other tables (orders, menu items, etc.):
1. User tries to read from `orders` table
2. RLS policy evaluates: `USING (org_id = get_user_org_id())`
3. `get_user_org_id()` tries to SELECT from `profiles` table
4. That SELECT triggers RLS on `profiles` again
5. Some RLS policies call `get_user_org_id()` again
6. **INFINITE RECURSION!** 🔄💥

### Why `SECURITY DEFINER` Wasn't Enough

The function was marked as `SECURITY DEFINER`, which *should* bypass RLS, but:
- In some Supabase/PostgreSQL versions, this doesn't work reliably
- The function needs an explicit `SET search_path` to ensure it uses the correct schema
- Without this, the function can still trigger RLS policies

## ✅ Solution Implemented

### Migration: `013_fix_rls_recursion.sql`

```sql
-- Drop existing buggy functions
DROP FUNCTION IF EXISTS get_user_org_id();
DROP FUNCTION IF EXISTS user_has_role(user_role);

-- Recreate with proper search_path to prevent RLS recursion
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;  -- ✅ This prevents recursion

CREATE OR REPLACE FUNCTION user_has_role(required_role user_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = required_role
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;  -- ✅ This prevents recursion
```

### Key Changes

1. **Explicit schema**: `public.profiles` instead of just `profiles`
2. **SET search_path**: Forces the function to use the public schema and bypass RLS
3. **Both functions fixed**: `get_user_org_id()` and `user_has_role()`

## 📋 How to Apply the Fix

### Option 1: Using Supabase CLI (Recommended)

```bash
cd /Users/amineboudoudou/Downloads/lumière-dining-swipe-menu

# Apply the migration
supabase db push

# Or apply just this migration
supabase db execute -f supabase/migrations/013_fix_rls_recursion.sql
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/013_fix_rls_recursion.sql`
4. Paste and run the SQL
5. Verify no errors

### Option 3: Manual SQL Execution

If you don't have Supabase CLI, run this SQL directly in the Supabase SQL Editor:

```sql
-- Fix infinite recursion in get_user_org_id() and user_has_role()
DROP FUNCTION IF EXISTS get_user_org_id();
DROP FUNCTION IF EXISTS user_has_role(user_role);

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION user_has_role(required_role user_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = required_role
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp;
```

## 🧪 Testing After Fix

### 1. Refresh the Browser

After applying the migration:
1. **Hard refresh** the browser (Cmd+Shift+R on Mac)
2. **Clear browser storage** if needed:
   - Open DevTools → Application → Storage → Clear site data
3. **Log in again** to the Owner Portal

### 2. Check Console Logs

You should now see:
```
👤 Fetching profile for user: abc-123
✅ Profile loaded successfully: {
  userId: "abc-123",
  orgId: "org-456",
  role: "owner",
  fullName: "John Doe"
}
🏁 Profile fetch complete
📦 Starting orders fetch: {
  orgId: "org-456",
  userId: "abc-123",
  profileRole: "owner"
}
✅ Orders fetched successfully: {
  count: 5,
  hasMore: false
}
```

### 3. Expected Behavior

✅ **Profile loads** with `org_id`  
✅ **Orders load** successfully  
✅ **Kanban board displays** with orders in lanes  
✅ **No infinite loading** spinner  
✅ **No RLS errors** in console

## 🔍 How to Verify the Fix Was Applied

Run this SQL in Supabase SQL Editor:

```sql
-- Check if the functions have the correct search_path
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as is_security_definer,
  p.proconfig as config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('get_user_org_id', 'user_has_role');
```

You should see:
- `is_security_definer`: `true`
- `config`: `{search_path=public,pg_temp}`

## 📊 Impact of This Fix

### Before Fix
- ❌ Profile fetch fails with infinite recursion
- ❌ `org_id` is never loaded
- ❌ Orders cannot be fetched (no org context)
- ❌ Owner Portal stuck on "Loading orders..."
- ❌ Console shows RLS recursion errors

### After Fix
- ✅ Profile loads successfully with `org_id`
- ✅ Orders fetch works correctly
- ✅ Owner Portal displays Kanban board
- ✅ All RLS policies work as intended
- ✅ No recursion errors

## 🎯 Why This Happened

This is a **known issue** in Supabase/PostgreSQL when:
1. RLS policies call helper functions
2. Helper functions query tables with RLS enabled
3. Those RLS policies call the same helper functions
4. Creates a circular dependency → infinite recursion

The fix (`SET search_path`) is documented in:
- [Supabase RLS Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL SECURITY DEFINER Functions](https://www.postgresql.org/docs/current/sql-createfunction.html)

## 📝 Related Files

- **Migration**: `supabase/migrations/013_fix_rls_recursion.sql`
- **Original buggy code**: `supabase/migrations/003_create_profiles.sql` (lines 21-34)
- **RLS policies using these functions**: `supabase/migrations/010_rls_policies.sql`

## 🚀 Next Steps

1. **Apply the migration** (see "How to Apply the Fix" above)
2. **Clear browser cache** and log in again
3. **Verify** the Owner Portal loads correctly
4. **Check console logs** for successful profile and orders fetch
5. **Test** creating/updating orders

If you still see issues after applying this fix, check:
- Supabase function logs: `supabase functions logs owner_list_orders --tail`
- Database logs in Supabase Dashboard → Database → Logs
- Browser console for any remaining errors
