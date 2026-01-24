# Database RLS Recursion Fix

## Problem
Profile fetch was returning 500 errors with "infinite recursion detected in policy for relation 'profiles'" in the database logs.

## Root Cause
The RLS policies on the `profiles` table were creating circular dependencies:

1. **Policy**: "Owners can read org profiles"
2. **Check**: Does user have role='owner' in same org?
3. **To check**: Read from `profiles` table
4. **Problem**: Reading `profiles` triggers the same policy again → infinite loop

## Solution
Use `SECURITY DEFINER` functions to break the recursion chain:

### Before (Recursive)
```sql
CREATE POLICY "Owners can read org profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS user_profile  -- ❌ Reads profiles while evaluating profiles policy
      WHERE user_profile.user_id = auth.uid()
        AND user_profile.org_id = profiles.org_id
        AND user_profile.role = 'owner'
    )
  );
```

### After (Non-Recursive)
```sql
-- Helper function with SECURITY DEFINER breaks the recursion
CREATE FUNCTION check_same_org(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER  -- ✅ Runs with elevated privileges, bypasses RLS
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND org_id = target_org_id
  );
$$;

-- Policy uses the function instead of direct query
CREATE POLICY "Users can read profiles in same org" ON profiles
  FOR SELECT
  TO authenticated
  USING (check_same_org(org_id));  -- ✅ No recursion
```

## How SECURITY DEFINER Helps
- Function runs with **creator's privileges** (postgres/admin)
- **Bypasses RLS** when reading profiles inside the function
- **Breaks the recursion** chain
- Still secure because function logic is controlled

## Applied Policies

### 1. Users Can Read Own Profile
```sql
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```
- Simple, no recursion
- Main use case for auth

### 2. Users Can Read Profiles in Same Org
```sql
CREATE POLICY "Users can read profiles in same org" ON profiles
  FOR SELECT
  TO authenticated
  USING (check_same_org(org_id));
```
- Uses SECURITY DEFINER function
- No recursion

### 3. Users Can Update Own Profile
```sql
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```
- Simple, no recursion

### 4. Owners Can Create Org Profiles
```sql
CREATE POLICY "Owners can create org profiles" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    check_same_org(org_id) AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role = 'owner'
    )
  );
```
- Uses SECURITY DEFINER function for org check
- Additional role check is safe (reads own profile only)

## Testing
```sql
-- Should work now (no 500 error)
SELECT * FROM profiles WHERE user_id = auth.uid();
```

## Verification
Check logs for errors:
```bash
# Should see no "infinite recursion" errors
supabase logs postgres
```

## Related Files
- Migration: `fix_profiles_rls_recursion_v2.sql`
- Migration: `simplify_profiles_rls.sql`
- Context: `contexts/AuthContext.tsx` (improved error handling)

## Key Learnings
1. **RLS policies can't read from the same table** they're protecting (creates recursion)
2. **SECURITY DEFINER functions** break the recursion by running with elevated privileges
3. **Keep policies simple** - complex org-wide operations should use Edge Functions with service role
4. **Always test RLS** with actual authenticated queries, not just admin queries

## Future Considerations
- Monitor function performance (SECURITY DEFINER can be slower)
- Consider caching org_id in JWT claims to avoid database lookup
- Use Edge Functions for complex multi-profile operations
