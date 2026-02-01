import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { OrdersLane } from '../../components/owner/OrdersLane';
import { Toast } from '../../components/Toast';
import { useSound } from '../../hooks/useSound';
import { useOrderRealtime } from '../../hooks/useOrderRealtime';
import type { Order, OrderStatus } from '../../types';
import { api } from '../../lib/api';

export const OrdersBoard: React.FC = () => {
    const navigate = useNavigate();
    const { profile, session, signOut } = useAuth();

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Sound notification hook
    const { play: playNotification } = useSound('/notification.mp3', { autoUnlock: true });

    // Real-time subscriptions
    useOrderRealtime({
        orgId: profile?.org_id || '',
        onNewPaidOrder: async (partialOrder) => {
            try {
                // Fetch full order to get items
                const fullOrder = await api.getOrder(partialOrder.id);
                setOrders(prev => [fullOrder, ...prev]);
                playNotification();
                setToastMessage(`🔔 New order #${fullOrder.order_number}!`);
            } catch (err) {
                console.error('Failed to fetch new order details:', err);
            }
        },
        onOrderUpdate: async (partialOrder) => {
            try {
                // Fetch full order to ensure data consistency
                const fullOrder = await api.getOrder(partialOrder.id);
                setOrders(prev => prev.map(o => o.id === fullOrder.id ? fullOrder : o));
            } catch (err) {
                console.error('Failed to fetch updated order details:', err);
            }
        },
    });

    // Group orders by status
    const { incoming, preparing, ready, completed } = useMemo(() => {
        return {
            // Simulation Mode: 'accepted' is the initial state (Incoming)
            incoming: orders.filter(o => o.status === 'accepted' || o.status === 'paid'),
            preparing: orders.filter(o => o.status === 'preparing'),
            ready: orders.filter(o => o.status === 'ready'),
            completed: orders.filter(o => o.status === 'completed'),
        };
    }, [orders]);

    // Fetch orders on mount
    useEffect(() => {
        let isMounted = true;
        let timeoutId: NodeJS.Timeout;

        if (!session) {
            navigate('/owner/login');
            return;
        }

        if (!profile?.org_id) {
            setLoading(true);
            setError(null);
            timeoutId = setTimeout(() => {
                if (isMounted && !profile?.org_id) {
                    setError('Could not load organization. Please try again.');
                    setLoading(false);
                }
            }, 8000);
            return () => { clearTimeout(timeoutId); isMounted = false; };
        }

        const fetchOrders = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await api.listOrders({
                    orgId: profile.org_id,
                    statuses: ['paid', 'accepted', 'preparing', 'ready', 'completed'],
                    limit: 100,
                });
                if (isMounted) setOrders(response.orders);
            } catch (err: any) {
                if (err?.name === 'AbortError') return;
                console.error('Orders fetch failed:', err);
                if (isMounted) setError(err.message || 'Failed to load orders');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchOrders();
        return () => { isMounted = false; if (timeoutId) clearTimeout(timeoutId); };
    }, [profile?.org_id, session, navigate]);

    // Handle quick actions
    const handleQuickAction = useCallback(async (order: Order, nextStatus: OrderStatus) => {
        try {
            const updatedOrder = await api.updateOrderStatus(order.id, nextStatus);
            setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
            setToastMessage(`Order #${order.order_number} to ${nextStatus}`);
        } catch (err: any) {
            setToastMessage(`Error: ${err.message}`);
        }
    }, []);

    const handleOrderClick = (order: Order) => navigate(`/owner/orders/${order.id}`);
    const handleRetry = () => window.location.reload();
    const handleLogout = async () => { try { await signOut(); navigate('/owner/login'); } catch { } };

    if (loading) {
        return (
            <OwnerLayout>
                <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                    <div className="text-white text-center">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-sm opacity-60">{!profile?.org_id ? 'Resolving organization...' : 'Loading orders...'}</p>
                    </div>
                </div>
            </OwnerLayout>
        );
    }

    if (error && orders.length === 0) {
        return (
            <OwnerLayout>
                <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                    <div className="text-center max-w-md">
                        <p className="text-red-400 mb-6">{error}</p>
                        <div className="flex gap-4 justify-center">
                            <button onClick={handleRetry} className="bg-primary hover:bg-accent text-white px-6 py-2 rounded-lg">Retry</button>
                            <button onClick={handleLogout} className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg">Logout</button>
                        </div>
                    </div>
                </div>
            </OwnerLayout>
        );
    }

    return (
        <OwnerLayout>
            <div className="p-4 md:p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-white text-2xl font-bold mb-2">Orders Board</h1>
                    <p className="text-white/60 text-sm">
                        Manage incoming orders and track their progress
                    </p>
                </div>

                {/* Kanban Board */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
                    <OrdersLane
                        title="Incoming"
                        orders={incoming}
                        emptyMessage="No new orders"
                        onOrderClick={handleOrderClick}
                        onQuickAction={(order) => handleQuickAction(order, 'preparing')}
                        quickActionLabel="Start Preparing"
                    />

                    <OrdersLane
                        title="Preparing"
                        orders={preparing}
                        emptyMessage="No orders in prep"
                        onOrderClick={handleOrderClick}
                        onQuickAction={(order) => handleQuickAction(order, 'ready')}
                        quickActionLabel="Mark Ready"
                    />

                    <OrdersLane
                        title="Ready"
                        orders={ready}
                        emptyMessage="No orders ready"
                        onOrderClick={handleOrderClick}
                        onQuickAction={(order) => handleQuickAction(order, 'completed')}
                        quickActionLabel="Complete"
                    />

                    <OrdersLane
                        title="Completed"
                        orders={completed}
                        emptyMessage="No completed orders"
                        onOrderClick={handleOrderClick}
                    />
                </div>
            </div>

            {toastMessage && (
                <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
            )}
        </OwnerLayout>
    );
};
