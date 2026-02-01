# Flavrr Multi-Tenant SaaS Architecture

## 1. Tenancy Model

### Core Entities
- **User**: Authenticated account via Supabase Auth
- **Workspace**: A business/organization using Flavrr (restaurant, creator, store)
- **Membership**: Links user ↔ workspace with role-based access

### Roles
- `owner`: Full control, billing, team management
- `admin`: Manage operations, team (no billing)
- `staff`: Limited access to assigned functions

### Data Isolation
- Every data table includes `workspace_id`
- Row-Level Security (RLS) enforces tenant boundaries
- Users can only access workspaces where they have membership

## 2. Routing Architecture

### Public Routes
- `/` - Marketing landing page
- `/login` - Authentication
- `/signup` - New user registration

### Onboarding
- `/onboarding/create-workspace` - First workspace creation (if user has 0 workspaces)

### Workspace Selection
- `/select-workspace` - Choose workspace (if user has >1 workspace)

### SaaS Application (Tenant-Scoped)
- `/app/:slug` - Workspace home/dashboard
- `/app/:slug/orders` - Orders management
- `/app/:slug/products` - Product/menu management
- `/app/:slug/settings` - Workspace settings
- `/app/:slug/billing` - Billing (owner only)
- `/app/:slug/team` - Team management (owner/admin)

### Customer Storefront (Public)
- `/order/:slug` - Public ordering page for workspace

## 3. Authentication & Authorization Flow

### Sign Up Flow
1. User creates account → Supabase Auth
2. Check memberships count
3. If 0 → redirect to `/onboarding/create-workspace`
4. Create workspace → user becomes owner
5. Redirect to `/app/:slug`

### Login Flow
1. User authenticates → Supabase Auth
2. Fetch user's workspace memberships
3. Decision tree:
   - 0 workspaces → `/onboarding/create-workspace`
   - 1 workspace → `/app/:slug` (direct)
   - >1 workspaces → `/select-workspace`

### Deep Link Flow
1. User visits `/app/:slug/*`
2. `WorkspaceGate` validates:
   - User is authenticated
   - Workspace exists
   - User has membership
3. Load workspace context (name, role, settings)
4. Render app content

## 4. Security Model (RLS Policies)

### Workspaces Table
- Users can read workspaces where they have membership
- Only workspace owner can update workspace
- Only workspace owner can delete workspace

### Memberships Table
- Users can read their own memberships
- Owners/admins can read all memberships in their workspace
- Only owners can create/delete memberships
- Only owners can change roles

### Application Tables (orders, products, etc.)
- All tables include `workspace_id`
- Users can only access rows where workspace_id matches their membership
- Role-based write permissions (owner/admin can write, staff read-only)

## 5. Frontend State Management

### AuthContext
- Manages Supabase auth session
- Provides `user`, `loading`, `signIn`, `signOut`

### WorkspaceContext
- Manages active workspace state
- Provides:
  - `activeWorkspace` (id, name, slug)
  - `userRole` (owner/admin/staff)
  - `memberships` (all user's workspaces)
  - `switchWorkspace(slug)`
  - `loading`

### Route Guards
- `AuthGate`: Ensures user is authenticated
- `WorkspaceGate`: Ensures user has access to workspace

## 6. UI/UX Consistency

### Design System
- White background with orange gradient accents
- Orange primary color: `#FF4D00` to `#FF9500`
- Clean cards with subtle shadows
- Consistent button styles (orange gradient)
- No dark/black portal UI

### Loading States
- Branded skeleton loaders (white + orange)
- No flickering during workspace resolution
- Smooth transitions between states

## 7. Migration Path

### Phase 1 (Current Implementation)
- Create workspaces & memberships tables
- Implement RLS policies
- Build routing structure
- Create AuthGate & WorkspaceGate
- Add workspace selection UI

### Phase 2 (Next Steps)
- Migrate existing Café Du Griot data to workspace model
- Update all application tables to include workspace_id
- Implement team invitations
- Add billing integration

### Phase 3 (Future)
- Multi-channel support (creators, stores)
- Advanced RBAC with custom permissions
- Workspace templates
- White-label options

## 8. Key Principles

1. **Zero Hardcoding**: No tenant-specific code in application logic
2. **Tenant Isolation**: Complete data separation via RLS
3. **Role-Based Access**: Granular permissions per workspace
4. **Seamless UX**: Smart routing based on user's workspace count
5. **Security First**: All queries tenant-scoped, validated at DB level
