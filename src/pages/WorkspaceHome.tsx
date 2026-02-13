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

    const metrics = [
        {
            label: "Today's Orders",
            value: '18',
            delta: '+12% vs yesterday'
        },
        {
            label: 'Revenue',
            value: '$1,240',
            delta: '+8% vs last week'
        },
        {
            label: 'Avg. Ticket',
            value: '$28.10',
            delta: '+4% this week'
        },
        {
            label: 'Repeat Customers',
            value: '42%',
            delta: '+6 new loyal fans'
        }
    ];

    const recentOrders = [
        { id: '#1023', customer: 'Mara Jay', total: '$48.20', status: 'Preparing', time: '2m ago' },
        { id: '#1022', customer: 'Leo Park', total: '$24.10', status: 'Ready', time: '12m ago' },
        { id: '#1021', customer: 'Sofia Ibarra', total: '$36.40', status: 'Delivered', time: '27m ago' },
        { id: '#1020', customer: 'Basil Co.', total: '$128.90', status: 'Scheduled', time: '1h ago' },
    ];

    const topProducts = [
        { name: 'Charred Citrus Bowl', orders: 112, trend: '+14%' },
        { name: 'Spiced Oat Latte', orders: 96, trend: '+6%' },
        { name: 'Midnight Baklava', orders: 81, trend: '+21%' },
    ];

    const statusBadge = (status: string) => {
        const colors: Record<string, string> = {
            Preparing: 'bg-amber-100 text-amber-700',
            Ready: 'bg-emerald-100 text-emerald-700',
            Delivered: 'bg-blue-100 text-blue-700',
            Scheduled: 'bg-purple-100 text-purple-700'
        };

        return colors[status] || 'bg-muted/10 text-muted';
    };

    return (
        <OwnerLayout>
            <div className="p-8 space-y-8">
                {/* Hero */}
                <div className="bg-gradient-to-r from-orange-50 via-white to-white border border-border rounded-[32px] p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 shadow-[var(--shadow)]">
                    <div>
                        <p className="text-muted text-xs uppercase tracking-[0.3em] mb-3">Workspace Overview</p>
                        <h1 className="text-3xl font-serif text-text mb-3">
                            Welcome back to {activeWorkspace?.name || 'your workspace'}
                        </h1>
                        <p className="text-muted max-w-2xl">
                            Daily health of your storefront, loyalty loop, and marketing cadence in one glance.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto">
                        {metrics.slice(0, 2).map((metric) => (
                            <div key={metric.label} className="bg-surface text-text border border-border rounded-2xl px-6 py-4">
                                <p className="text-sm text-muted mb-1">{metric.label}</p>
                                <p className="text-2xl font-bold">{metric.value}</p>
                                <p className="text-xs text-emerald-600 font-medium">{metric.delta}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <button
                                key={action.path}
                                onClick={() => navigate(action.path)}
                                className="bg-surface-2 border border-border rounded-2xl p-6 hover:-translate-y-1 hover:shadow-lg transition-all group text-left"
                            >
                                <div className={`w-12 h-12 bg-gradient-to-r ${action.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-text font-semibold text-lg mb-1">
                                    {action.title}
                                </h3>
                                <p className="text-muted text-sm">
                                    {action.description}
                                </p>
                            </button>
                        );
                    })}
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {metrics.map((metric) => (
                        <div key={metric.label} className="bg-surface border border-border rounded-3xl p-6 shadow-[var(--shadow)]">
                            <p className="text-sm text-muted mb-2">{metric.label}</p>
                            <p className="text-3xl font-bold text-text mb-1">{metric.value}</p>
                            <p className="text-xs font-medium text-emerald-600">{metric.delta}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Recent Orders */}
                    <div className="bg-surface border border-border rounded-3xl p-6 shadow-[var(--shadow)] xl:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm text-muted uppercase tracking-[0.3em]">Live Orders</p>
                                <h2 className="text-2xl font-semibold text-text">Pipeline snapshot</h2>
                            </div>
                            <button
                                onClick={() => navigate(`/app/${activeWorkspace?.slug}/orders`)}
                                className="text-sm font-medium text-primary hover:text-primary-hover"
                            >
                                View all
                            </button>
                        </div>
                        <div className="divide-y divide-border">
                            {recentOrders.map((order) => (
                                <div key={order.id} className="py-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-text font-medium">{order.id}</p>
                                        <p className="text-muted text-sm">{order.customer}</p>
                                    </div>
                                    <div className="hidden md:block text-text font-semibold">{order.total}</div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(order.status)}`}>
                                        {order.status}
                                    </span>
                                    <p className="text-muted text-sm w-20 text-right">{order.time}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Products */}
                    <div className="bg-surface border border-border rounded-3xl p-6 shadow-[var(--shadow)]">
                        <p className="text-sm text-muted uppercase tracking-[0.3em] mb-2">Momentum</p>
                        <h2 className="text-2xl font-semibold text-text mb-4">Top products</h2>
                        <div className="space-y-4">
                            {topProducts.map((product, index) => (
                                <div key={product.name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center text-sm font-semibold text-text">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <p className="text-text font-medium">{product.name}</p>
                                            <p className="text-muted text-sm">{product.orders} orders</p>
                                        </div>
                                    </div>
                                    <p className="text-emerald-600 text-sm font-semibold">{product.trend}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </OwnerLayout>
    );
};
