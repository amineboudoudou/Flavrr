-- Migration: Create workspaces and workspace_memberships tables for multi-tenant SaaS
-- This enables Flavrr to support multiple businesses/organizations

-- =====================================================
-- 1. CREATE WORKSPACES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Workspace metadata
    logo_url TEXT,
    description TEXT,
    website TEXT,
    
    -- Workspace settings
    settings JSONB DEFAULT '{}'::jsonb,
    
    -- Constraints
    CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT slug_length CHECK (char_length(slug) >= 3 AND char_length(slug) <= 63)
);

-- Add indexes
CREATE INDEX idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX idx_workspaces_created_by ON public.workspaces(created_by);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. CREATE WORKSPACE_MEMBERSHIPS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.workspace_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint: one membership per user per workspace
    CONSTRAINT unique_workspace_user UNIQUE (workspace_id, user_id)
);

-- Add indexes
CREATE INDEX idx_memberships_workspace ON public.workspace_memberships(workspace_id);
CREATE INDEX idx_memberships_user ON public.workspace_memberships(user_id);
CREATE INDEX idx_memberships_role ON public.workspace_memberships(role);

-- Add updated_at trigger
CREATE TRIGGER update_memberships_updated_at
    BEFORE UPDATE ON public.workspace_memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- WORKSPACES POLICIES
-- =====================================================

-- Policy: Users can read workspaces where they have membership
CREATE POLICY "Users can read their workspaces"
    ON public.workspaces
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships
            WHERE workspace_memberships.workspace_id = workspaces.id
            AND workspace_memberships.user_id = auth.uid()
        )
    );

-- Policy: Users can create workspaces (they become owner automatically)
CREATE POLICY "Users can create workspaces"
    ON public.workspaces
    FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- Policy: Only workspace owners can update workspace
CREATE POLICY "Owners can update their workspace"
    ON public.workspaces
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships
            WHERE workspace_memberships.workspace_id = workspaces.id
            AND workspace_memberships.user_id = auth.uid()
            AND workspace_memberships.role = 'owner'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships
            WHERE workspace_memberships.workspace_id = workspaces.id
            AND workspace_memberships.user_id = auth.uid()
            AND workspace_memberships.role = 'owner'
        )
    );

-- Policy: Only workspace owners can delete workspace
CREATE POLICY "Owners can delete their workspace"
    ON public.workspaces
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships
            WHERE workspace_memberships.workspace_id = workspaces.id
            AND workspace_memberships.user_id = auth.uid()
            AND workspace_memberships.role = 'owner'
        )
    );

-- =====================================================
-- WORKSPACE_MEMBERSHIPS POLICIES
-- =====================================================

-- Policy: Users can read their own memberships
CREATE POLICY "Users can read their own memberships"
    ON public.workspace_memberships
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy: Owners and admins can read all memberships in their workspace
CREATE POLICY "Owners and admins can read workspace memberships"
    ON public.workspace_memberships
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships AS wm
            WHERE wm.workspace_id = workspace_memberships.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
    );

-- Policy: Only workspace owners can create memberships (invite team)
CREATE POLICY "Owners can create memberships"
    ON public.workspace_memberships
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships AS wm
            WHERE wm.workspace_id = workspace_memberships.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role = 'owner'
        )
    );

-- Policy: Only workspace owners can update memberships (change roles)
CREATE POLICY "Owners can update memberships"
    ON public.workspace_memberships
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships AS wm
            WHERE wm.workspace_id = workspace_memberships.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role = 'owner'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships AS wm
            WHERE wm.workspace_id = workspace_memberships.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role = 'owner'
        )
    );

-- Policy: Only workspace owners can delete memberships (remove team members)
CREATE POLICY "Owners can delete memberships"
    ON public.workspace_memberships
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships AS wm
            WHERE wm.workspace_id = workspace_memberships.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role = 'owner'
        )
    );

-- =====================================================
-- 4. HELPER FUNCTIONS
-- =====================================================

-- Function: Get user's workspaces with role
CREATE OR REPLACE FUNCTION get_user_workspaces(user_uuid UUID)
RETURNS TABLE (
    workspace_id UUID,
    workspace_name TEXT,
    workspace_slug TEXT,
    user_role TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id,
        w.name,
        w.slug,
        wm.role,
        wm.created_at
    FROM public.workspaces w
    INNER JOIN public.workspace_memberships wm ON w.id = wm.workspace_id
    WHERE wm.user_id = user_uuid
    ORDER BY wm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user has access to workspace
CREATE OR REPLACE FUNCTION user_has_workspace_access(user_uuid UUID, workspace_slug_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.workspaces w
        INNER JOIN public.workspace_memberships wm ON w.id = wm.workspace_id
        WHERE w.slug = workspace_slug_param
        AND wm.user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get user's role in workspace
CREATE OR REPLACE FUNCTION get_user_workspace_role(user_uuid UUID, workspace_slug_param TEXT)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT wm.role INTO user_role
    FROM public.workspaces w
    INNER JOIN public.workspace_memberships wm ON w.id = wm.workspace_id
    WHERE w.slug = workspace_slug_param
    AND wm.user_id = user_uuid;
    
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. GRANT PERMISSIONS
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant permissions on tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_memberships TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_user_workspaces(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_workspace_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_workspace_role(UUID, TEXT) TO authenticated;

-- =====================================================
-- 6. COMMENTS
-- =====================================================

COMMENT ON TABLE public.workspaces IS 'Stores workspace/organization information for multi-tenant SaaS';
COMMENT ON TABLE public.workspace_memberships IS 'Links users to workspaces with role-based access control';
COMMENT ON FUNCTION get_user_workspaces(UUID) IS 'Returns all workspaces a user has access to with their role';
COMMENT ON FUNCTION user_has_workspace_access(UUID, TEXT) IS 'Checks if user has access to a specific workspace by slug';
COMMENT ON FUNCTION get_user_workspace_role(UUID, TEXT) IS 'Returns user role in a specific workspace';
