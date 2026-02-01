import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface Workspace {
    id: string;
    name: string;
    slug: string;
    role: 'owner' | 'admin' | 'staff';
    created_at: string;
}

interface WorkspaceContextValue {
    activeWorkspace: Workspace | null;
    memberships: Workspace[];
    loading: boolean;
    error: string | null;
    switchWorkspace: (slug: string) => void;
    refreshMemberships: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
    const [memberships, setMemberships] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMemberships = async () => {
        if (!user) {
            setMemberships([]);
            setActiveWorkspace(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase.rpc('get_user_workspaces', {
                user_uuid: user.id
            });

            if (fetchError) throw fetchError;

            const workspaces: Workspace[] = (data || []).map((w: any) => ({
                id: w.workspace_id,
                name: w.workspace_name,
                slug: w.workspace_slug,
                role: w.user_role,
                created_at: w.created_at
            }));

            setMemberships(workspaces);

            // Set active workspace from localStorage or first workspace
            const storedSlug = localStorage.getItem('flavrr_active_workspace');
            if (storedSlug) {
                const workspace = workspaces.find(w => w.slug === storedSlug);
                if (workspace) {
                    setActiveWorkspace(workspace);
                } else if (workspaces.length > 0) {
                    setActiveWorkspace(workspaces[0]);
                    localStorage.setItem('flavrr_active_workspace', workspaces[0].slug);
                }
            } else if (workspaces.length > 0) {
                setActiveWorkspace(workspaces[0]);
                localStorage.setItem('flavrr_active_workspace', workspaces[0].slug);
            }
        } catch (err: any) {
            console.error('Failed to fetch workspaces:', err);
            setError(err.message || 'Failed to load workspaces');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMemberships();
    }, [user]);

    const switchWorkspace = (slug: string) => {
        const workspace = memberships.find(w => w.slug === slug);
        if (workspace) {
            setActiveWorkspace(workspace);
            localStorage.setItem('flavrr_active_workspace', slug);
        }
    };

    const refreshMemberships = async () => {
        await fetchMemberships();
    };

    const value: WorkspaceContextValue = {
        activeWorkspace,
        memberships,
        loading,
        error,
        switchWorkspace,
        refreshMemberships,
    };

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}
