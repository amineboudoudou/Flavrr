import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { ShoppingBag, ArrowRight, Building2 } from 'lucide-react';

export const SelectWorkspace: React.FC = () => {
    const navigate = useNavigate();
    const { memberships, loading, switchWorkspace } = useWorkspace();

    const handleSelectWorkspace = (slug: string) => {
        switchWorkspace(slug);
        navigate(`/app/${slug}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Loading workspaces...</p>
                </div>
            </div>
        );
    }

    if (memberships.length === 0) {
        navigate('/onboarding/create-workspace');
        return null;
    }

    if (memberships.length === 1) {
        navigate(`/app/${memberships[0].slug}`);
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-white flex items-center justify-center px-4 relative overflow-hidden">
            {/* Subtle gradient glow */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-orange-100/40 to-transparent blur-3xl pointer-events-none"></div>
            
            <div className="w-full max-w-2xl relative z-10">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-6">
                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-2 rounded-xl">
                            <ShoppingBag className="w-8 h-8 text-white" />
                        </div>
                        <span className="text-3xl font-black tracking-tighter">flavrr</span>
                    </div>
                    <h1 className="text-4xl font-extrabold text-gray-900 mb-3">
                        Select Workspace
                    </h1>
                    <p className="text-gray-500 text-lg">
                        Choose which business you'd like to manage
                    </p>
                </div>

                {/* Workspaces Grid */}
                <div className="grid gap-4 mb-6">
                    {memberships.map((workspace) => (
                        <button
                            key={workspace.id}
                            onClick={() => handleSelectWorkspace(workspace.slug)}
                            className="bg-white rounded-2xl border border-black/5 shadow-lg hover:shadow-xl p-6 transition-all hover:scale-[1.02] text-left group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                                    <Building2 className="w-8 h-8 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-2xl font-black text-gray-900 mb-1 truncate">
                                        {workspace.name}
                                    </h2>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-gray-500 font-medium">
                                            /{workspace.slug}
                                        </span>
                                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full uppercase">
                                            {workspace.role}
                                        </span>
                                    </div>
                                </div>
                                <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                            </div>
                        </button>
                    ))}
                </div>

                {/* Create New Workspace */}
                <div className="text-center">
                    <button
                        onClick={() => navigate('/onboarding/create-workspace')}
                        className="text-orange-600 hover:text-orange-700 font-semibold text-sm transition-colors"
                    >
                        + Create new workspace
                    </button>
                </div>
            </div>
        </div>
    );
};
