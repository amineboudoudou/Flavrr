import React from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { OwnerLayout } from '../components/owner/OwnerLayout';
import { useNavigate } from 'react-router-dom';
import { Package, ShoppingCart, Users, TrendingUp } from 'lucide-react';

export const WorkspaceHome: React.FC = () => {
    const { activeWorkspace } = useWorkspace();
    const navigate = useNavigate();

    const quickActions = [
        {
            title: 'Orders',
            description: 'View and manage orders',
            icon: ShoppingCart,
            path: `/app/${activeWorkspace?.slug}/orders`,
            color: 'from-orange-500 to-orange-600'
        },
        {
            title: 'Products',
            description: 'Manage your menu',
            icon: Package,
            path: `/app/${activeWorkspace?.slug}/products`,
            color: 'from-blue-500 to-blue-600'
        },
        {
            title: 'Customers',
            description: 'View customer data',
            icon: Users,
            path: `/app/${activeWorkspace?.slug}/customers`,
            color: 'from-green-500 to-green-600'
        },
        {
            title: 'Analytics',
            description: 'Track performance',
            icon: TrendingUp,
            path: `/app/${activeWorkspace?.slug}/analytics`,
            color: 'from-purple-500 to-purple-600'
        }
    ];

    return (
        <OwnerLayout>
            <div className="p-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Welcome back to {activeWorkspace?.name}
                    </h1>
                    <p className="text-white/60">
                        Here's what's happening with your business today
                    </p>
                </div>

                {/* Quick Actions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <button
                                key={action.path}
                                onClick={() => navigate(action.path)}
                                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all group"
                            >
                                <div className={`w-12 h-12 bg-gradient-to-r ${action.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-white font-bold text-lg mb-1">
                                    {action.title}
                                </h3>
                                <p className="text-white/60 text-sm">
                                    {action.description}
                                </p>
                            </button>
                        );
                    })}
                </div>

                {/* Stats Overview */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                        <p className="text-white/60 text-sm mb-2">Today's Orders</p>
                        <p className="text-white text-3xl font-bold">0</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                        <p className="text-white/60 text-sm mb-2">Revenue</p>
                        <p className="text-white text-3xl font-bold">$0.00</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                        <p className="text-white/60 text-sm mb-2">Active Products</p>
                        <p className="text-white text-3xl font-bold">0</p>
                    </div>
                </div>
            </div>
        </OwnerLayout>
    );
};
