import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { supabase } from '../lib/supabase';
import { ShoppingBag } from 'lucide-react';

export const CreateWorkspace: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { refreshMemberships } = useWorkspace();
    
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const generateSlug = (input: string) => {
        return input
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 63);
    };

    const handleNameChange = (value: string) => {
        setName(value);
        if (!slug || slug === generateSlug(name)) {
            setSlug(generateSlug(value));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        if (!name || !slug) {
            setError('Please fill in all fields');
            setIsSubmitting(false);
            return;
        }

        if (slug.length < 3) {
            setError('Workspace URL must be at least 3 characters');
            setIsSubmitting(false);
            return;
        }

        if (!/^[a-z0-9-]+$/.test(slug)) {
            setError('Workspace URL can only contain lowercase letters, numbers, and hyphens');
            setIsSubmitting(false);
            return;
        }

        try {
            // Create workspace
            const { data: workspace, error: workspaceError } = await supabase
                .from('workspaces')
                .insert({
                    name,
                    slug,
                    created_by: user?.id
                })
                .select()
                .single();

            if (workspaceError) throw workspaceError;

            // Create owner membership
            const { error: membershipError } = await supabase
                .from('workspace_memberships')
                .insert({
                    workspace_id: workspace.id,
                    user_id: user?.id,
                    role: 'owner'
                });

            if (membershipError) throw membershipError;

            // Refresh memberships
            await refreshMemberships();

            // Redirect to workspace
            navigate(`/app/${slug}`);
        } catch (err: any) {
            console.error('Failed to create workspace:', err);
            if (err.code === '23505') {
                setError('This workspace URL is already taken');
            } else {
                setError(err.message || 'Failed to create workspace');
            }
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-white flex items-center justify-center px-4 relative overflow-hidden">
            {/* Subtle gradient glow */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-orange-100/40 to-transparent blur-3xl pointer-events-none"></div>
            
            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-6">
                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-2 rounded-xl">
                            <ShoppingBag className="w-8 h-8 text-white" />
                        </div>
                        <span className="text-3xl font-black tracking-tighter">flavrr</span>
                    </div>
                    <h1 className="text-4xl font-extrabold text-gray-900 mb-3">
                        Create Your Workspace
                    </h1>
                    <p className="text-gray-500 text-lg">
                        Set up your business on Flavrr
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.12)] p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Workspace Name */}
                        <div>
                            <label htmlFor="name" className="block text-gray-700 text-sm font-medium mb-2">
                                Workspace Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => handleNameChange(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                placeholder="My Restaurant"
                                disabled={isSubmitting}
                                autoFocus
                            />
                        </div>

                        {/* Workspace URL */}
                        <div>
                            <label htmlFor="slug" className="block text-gray-700 text-sm font-medium mb-2">
                                Workspace URL <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-sm font-medium">flavrr.app/</span>
                                <input
                                    id="slug"
                                    type="text"
                                    value={slug}
                                    onChange={(e) => setSlug(generateSlug(e.target.value))}
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                    placeholder="my-restaurant"
                                    disabled={isSubmitting}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Lowercase letters, numbers, and hyphens only
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-red-600 text-sm font-medium">{error}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {isSubmitting ? 'Creating workspace...' : 'Create Workspace'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
