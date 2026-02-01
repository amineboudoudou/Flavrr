-- Fix infinite recursion in get_user_org_id() and user_has_role()
-- These functions were causing RLS policy evaluation loops

-- Drop existing functions
DROP FUNCTION IF EXISTS get_user_org_id();
DROP FUNCTION IF EXISTS user_has_role(user_role);

-- Recreate with proper search_path to prevent RLS recursion
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
