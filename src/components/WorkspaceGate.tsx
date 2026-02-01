import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface WorkspaceGateProps {
    children: React.ReactNode;
}

export const WorkspaceGate: React.FC<WorkspaceGateProps> = ({ children }) => {
    const { slug } = useParams<{ slug: string }>();
    const { user } = useAuth();
    const { memberships, loading: workspaceLoading, switchWorkspace } = useWorkspace();
    const [validating, setValidating] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);

    useEffect(() => {
        const validateAccess = async () => {
            if (!slug || !user || workspaceLoading) return;

            try {
                // Check if user has membership to this workspace
                const workspace = memberships.find(w => w.slug === slug);
                
                if (workspace) {
                    // User has access, switch to this workspace
                    switchWorkspace(slug);
                    setHasAccess(true);
                } else {
                    // Double-check with database
                    const { data, error } = await supabase.rpc('user_has_workspace_access', {
                        user_uuid: user.id,
                        workspace_slug_param: slug
                    });

                    if (error) throw error;
                    setHasAccess(data === true);
                }
            } catch (error) {
                console.error('Workspace validation error:', error);
                setHasAccess(false);
            } finally {
                setValidating(false);
            }
        };

        validateAccess();
    }, [slug, user, memberships, workspaceLoading]);

    if (workspaceLoading || validating) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Loading workspace...</p>
                </div>
            </div>
        );
    }

    if (!hasAccess) {
        return <Navigate to="/select-workspace" replace />;
    }

    return <>{children}</>;
};
