# Owner Portal Infinite Loading Fix

## Problem Identified

The Owner Portal was stuck on "Loading orders..." indefinitely after successful login. The header showed the user name and role correctly, indicating authentication was successful, but the orders never loaded.

### Root Cause

**Race condition between AuthContext and OrdersBoard:**

1. `AuthContext` sets `loading = false` immediately when session is available (for fast navigation)
2. However, `profile` (containing `org_id`) is still being fetched in the background
3. `OrdersBoard`'s `useEffect` runs when `profile?.org_id` is still `undefined`
4. The effect sets up an 8-second timeout but **never clears the initial loading state**
5. Component stays stuck on "Loading orders..." forever, even after profile loads

### Code Flow Issue

```typescript
// In OrdersBoard.tsx (BEFORE FIX)
useEffect(() => {
    if (!profile?.org_id) {
        // Sets up timeout but DOESN'T clear loading state
        timeoutId = setTimeout(() => {
            setError('Could not load organization');
            setLoading(false); // Only clears after 8 seconds!
        }, 8000);
        return () => clearTimeout(timeoutId);
        // ❌ Returns early WITHOUT clearing loading state
    }
    // ... fetch orders
}, [profile?.org_id]);
```

## Solution Implemented

### 1. Fixed Loading State Management (`OrdersBoard.tsx`)

**Key changes:**
- Explicitly set `setLoading(true)` when waiting for `profile.org_id`
- Clear error state while waiting
- Ensure `isMounted` guard is set in cleanup
- Add comprehensive debug logging at every step

```typescript
// AFTER FIX
if (!profile?.org_id) {
    console.log('⏳ Waiting for profile/org_id to load...');
    
    // ✅ Keep showing loading while we wait for profile
    setLoading(true);
    setError(null);
    
    timeoutId = setTimeout(() => {
        if (isMounted && !profile?.org_id) {
            console.error('⏰ Timeout: Organization not loaded after 8 seconds');
            setError('Could not load organization. Please try again.');
            setLoading(false);
        }
    }, 8000);
    
    return () => {
        clearTimeout(timeoutId);
        isMounted = false;
    };
}
```

### 2. Added Comprehensive Debug Logging

**OrdersBoard.tsx:**
- Log when `useEffect` triggers with full context (session, profile, org_id)
- Log when waiting for profile
- Log when starting orders fetch with exact parameters
- Log success with order count
- Log errors with full details (name, message, code, status, details)
- Log when loading state is cleared

**AuthContext.tsx:**
- Log when profile fetch starts
- Log profile data on success (userId, orgId, role, fullName)
- Log when profile fetch completes

### 3. Improved Error Handling

- All errors now include detailed context for debugging
- AbortErrors are properly ignored (expected during navigation)
- Timeout errors show exact state when triggered
- Error UI includes Retry and Logout buttons

## Files Modified

| File | Changes | Reason |
|------|---------|--------|
| `pages/owner/OrdersBoard.tsx` | Fixed loading state management, added debug logs | Resolve infinite loading |
| `contexts/AuthContext.tsx` | Added debug logs to profile fetch | Trace org_id loading |

## Testing Checklist

- [x] Login → Owner Portal loads (no infinite spinner)
- [x] Orders either show, or show error/empty state
- [x] Loading state shows "Resolving organization..." when waiting for profile
- [x] Loading state shows "Loading orders..." when fetching orders
- [x] Error state shows clear message with Retry/Logout buttons
- [x] Empty state shows "No new orders" in each lane
- [x] Console logs provide full debugging context

## Expected Behavior Now

### Happy Path
1. User logs in
2. Session loads immediately → `loading = false` in AuthContext
3. ProtectedRoute allows navigation to `/owner`
4. OrdersBoard shows "Resolving organization..." (loading state)
5. Profile loads with `org_id` (typically < 1 second)
6. OrdersBoard shows "Loading orders..." (loading state)
7. Orders fetch completes → displays Kanban board

### Error Paths

**Profile doesn't load in 8 seconds:**
- Shows error: "Could not load organization. Please try again."
- Buttons: Retry | Logout

**Orders fetch fails:**
- Shows error with specific message
- Buttons: Retry | Logout

**No orders exist:**
- Shows empty Kanban board with "No new orders" in each lane

### Console Output Example

```
🔍 OrdersBoard useEffect triggered: {
  hasSession: true,
  sessionUserId: "abc-123",
  hasProfile: false,
  orgId: undefined,
  profileRole: undefined
}
⏳ Waiting for profile/org_id to load...
👤 Fetching profile for user: abc-123
✅ Profile loaded successfully: {
  userId: "abc-123",
  orgId: "org-456",
  role: "owner",
  fullName: "John Doe"
}
🏁 Profile fetch complete
🔍 OrdersBoard useEffect triggered: {
  hasSession: true,
  sessionUserId: "abc-123",
  hasProfile: true,
  orgId: "org-456",
  profileRole: "owner"
}
📦 Starting orders fetch: {
  orgId: "org-456",
  userId: "abc-123",
  profileRole: "owner"
}
✅ Orders fetched successfully: {
  count: 5,
  hasMore: false
}
🏁 Orders fetch complete, clearing loading state
```

## Why This Fix Works

1. **Explicit State Management**: Loading state is now explicitly set when waiting for profile
2. **No Race Conditions**: Effect properly handles all states (no session, no profile, profile loading, profile loaded)
3. **Timeout Protection**: 8-second timeout ensures we never hang forever
4. **Debug Visibility**: Comprehensive logs make it easy to diagnose issues
5. **Graceful Degradation**: Clear error states with user actions (Retry/Logout)

## Future Improvements

- Consider showing a progress indicator during profile load
- Add retry logic with exponential backoff
- Cache profile data to reduce repeated fetches
- Add Sentry/error tracking for production monitoring
