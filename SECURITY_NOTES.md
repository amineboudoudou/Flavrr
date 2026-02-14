# Security Notes - Stripe Connect Multi-Tenant Implementation

## Why `verify_jwt = false` is Safe

### The Problem
Supabase's edge function gateway blocks OPTIONS preflight requests when `verify_jwt = true`, causing CORS failures from browser clients.

### The Solution
We disable gateway-level JWT verification (`verify_jwt = false`) but implement **manual JWT verification** inside each function for all non-OPTIONS requests.

### Security Properties

#### 1. OPTIONS Requests (Preflight)
- **No authentication required** - This is standard CORS behavior
- Returns only CORS headers, no sensitive data
- No database operations performed
- HTTP 200 response with headers only

#### 2. POST Requests (Actual Operations)
- **Manual JWT verification enforced** using Supabase ANON key
- Steps performed:
  1. Extract `Authorization: Bearer <token>` header
  2. Call `supabase.auth.getUser(token)` with ANON key
  3. Verify user exists and token is valid
  4. Reject with 401 if verification fails

#### 3. Why This is Secure
- **Same security as gateway verification**: We use the same Supabase auth mechanism
- **ANON key is safe**: It's designed for client-side use and JWT verification
- **No privilege escalation**: Service role key only used after auth verification
- **Audit trail**: All auth failures logged with user context

---

## Tenant Derivation Strategy

### Problem: Client-Provided IDs are Unsafe
Allowing clients to specify `workspace_id` or `org_id` enables cross-tenant attacks:
```typescript
// BAD: Client can specify any workspace_id
POST /connect-create-account
{ "workspace_id": "someone-elses-workspace" }
```

### Solution: Server-Side Tenant Derivation

#### Step 1: Verify JWT
```typescript
const token = authHeader.replace('Bearer ', '');
const { data: { user }, error } = await supabase.auth.getUser(token);
// user.id is now trusted
```

#### Step 2: Fetch User Profile
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('org_id, role')
  .eq('user_id', user.id)
  .single();
// profile.org_id is the user's organization
```

#### Step 3: Verify Role
```typescript
if (!['owner', 'admin'].includes(profile.role)) {
  return 403; // Forbidden
}
```

#### Step 4: Find Workspace
```typescript
const { data: workspaces } = await supabase
  .from('workspaces')
  .select('id, slug, name')
  .eq('org_id', profile.org_id)
  .order('created_at', { ascending: false });

const workspace = workspaces[0]; // Most recent workspace
```

#### Step 5: Use Derived Workspace
```typescript
// All operations use workspace.id from server-side lookup
await supabase
  .from('seller_payout_accounts')
  .select('*')
  .eq('workspace_id', workspace.id); // Safe!
```

### Security Guarantees

1. **No Cross-Tenant Access**: User can only access workspaces for their org_id
2. **Role Enforcement**: Only owners/admins can manage payout accounts
3. **Audit Trail**: All operations logged with user_id and workspace_id
4. **No Client Trust**: Client cannot influence which tenant is accessed

---

## CORS Configuration

### Allowed Origins
- **Production**: `https://flavrr-snowy.vercel.app`
- **Development**: `localhost:5173`, `localhost:3000`
- **Previews**: Any `*.vercel.app` domain

### Why Allow All Vercel Previews?
- **Development velocity**: Every PR gets a preview deployment
- **Testing**: QA can test features before merge
- **Acceptable risk**: Preview URLs are ephemeral and require auth anyway

### Headers Returned
```typescript
{
  'Access-Control-Allow-Origin': '<echoed-origin-if-allowed>',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400', // 24 hours
}
```

### Applied to All Responses
- ✅ 200 Success
- ✅ 400 Bad Request
- ✅ 401 Unauthorized
- ✅ 403 Forbidden
- ✅ 404 Not Found
- ✅ 500 Internal Server Error

---

## Attack Scenarios & Mitigations

### Scenario 1: Malicious Client Provides Fake workspace_id
**Attack**: Client sends `{"workspace_id": "victim-workspace"}`

**Mitigation**: 
- ✅ workspace_id not accepted from client
- ✅ Server derives workspace from JWT → profile → org_id → workspaces
- ✅ User can only access their own org's workspaces

### Scenario 2: Stolen JWT Token
**Attack**: Attacker steals valid JWT and makes requests

**Mitigation**:
- ⚠️ Token is valid until expiry (standard JWT limitation)
- ✅ Operations still scoped to token owner's org
- ✅ No privilege escalation possible
- 🔒 **Recommendation**: Implement token refresh rotation

### Scenario 3: CORS Bypass Attempt
**Attack**: Attacker tries to call function from unauthorized origin

**Mitigation**:
- ✅ Browser enforces CORS (can't be bypassed by attacker)
- ✅ Server validates origin and only echoes if allowed
- ✅ Unauthorized origins get default prod origin (request fails in browser)

### Scenario 4: OPTIONS Flood (DoS)
**Attack**: Attacker floods OPTIONS endpoint

**Mitigation**:
- ✅ OPTIONS is lightweight (no DB calls)
- ✅ Max-Age: 86400 reduces preflight frequency
- ⚠️ **TODO**: Add rate limiting at edge/CDN level

### Scenario 5: Multiple Workspaces Confusion
**Attack**: User has 2+ workspaces, tries to access wrong one

**Mitigation**:
- ✅ Server selects most recent workspace by default
- ✅ Logs warning when multiple workspaces exist
- 🔒 **Future**: Accept optional `workspace_slug` in request, verify membership server-side

---

## Compliance & Best Practices

### PCI DSS
- ✅ No card data stored in Flavrr database
- ✅ All payment processing via Stripe
- ✅ Stripe Connect for merchant payouts
- ✅ No PCI scope for Flavrr

### Data Protection
- ✅ JWT verified server-side
- ✅ RLS policies enforce tenant isolation
- ✅ Audit logging for all operations
- ⚠️ **TODO**: Sanitize PII from logs (email, phone)

### Authentication
- ✅ Manual JWT verification with ANON key
- ✅ No service role key exposed to client
- ✅ Role-based access control (owner/admin)
- ✅ Session management via Supabase Auth

---

## Testing Verification

### Test 1: OPTIONS Preflight
```bash
curl -i -X OPTIONS \
  'https://lcgckjfhlvuxnnjylzvk.supabase.co/functions/v1/connect-create-account' \
  -H 'Origin: https://flavrr-preview-abc123.vercel.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization, content-type'
```

**Expected**:
- Status: 200
- Header: `Access-Control-Allow-Origin: https://flavrr-preview-abc123.vercel.app`
- Header: `Access-Control-Allow-Methods: GET, POST, OPTIONS`

### Test 2: POST Without Auth
```bash
curl -i -X POST \
  'https://lcgckjfhlvuxnnjylzvk.supabase.co/functions/v1/connect-create-account' \
  -H 'Origin: https://flavrr-preview-abc123.vercel.app' \
  -H 'Content-Type: application/json'
```

**Expected**:
- Status: 401
- Body: `{"error":"Missing authorization header"}`
- Header: `Access-Control-Allow-Origin: https://flavrr-preview-abc123.vercel.app`

### Test 3: POST With Valid Auth
```bash
curl -i -X POST \
  'https://lcgckjfhlvuxnnjylzvk.supabase.co/functions/v1/connect-create-account' \
  -H 'Origin: https://flavrr-preview-abc123.vercel.app' \
  -H 'Authorization: Bearer <valid-jwt>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Expected**:
- Status: 200
- Body: `{"account_id":"acct_...","workspace_id":"...","workspace_slug":"..."}`
- Header: `Access-Control-Allow-Origin: https://flavrr-preview-abc123.vercel.app`

---

## Monitoring & Alerts

### Recommended Alerts
1. **High 401 Rate**: Potential credential stuffing attack
2. **High 403 Rate**: Potential authorization bypass attempt
3. **Multiple Workspaces Warning**: User experience issue
4. **Stripe Account Creation Failure**: Integration issue

### Logs to Monitor
- Auth verification failures (user_id, error)
- Workspace derivation (user_id, org_id, workspace_id)
- Stripe API calls (account_id, operation)
- CORS violations (origin, method)

---

## Future Enhancements

### Short Term
1. Add workspace_slug parameter (optional, server-verified)
2. Implement rate limiting (IP + user-based)
3. Add input validation (max lengths, formats)
4. Sanitize PII from logs

### Long Term
1. Token refresh rotation
2. Anomaly detection (unusual access patterns)
3. Multi-factor authentication for sensitive operations
4. Webhook signature verification for Stripe events

---

**Last Updated**: February 14, 2026  
**Reviewed By**: Engineering Team  
**Next Review**: Before production launch
