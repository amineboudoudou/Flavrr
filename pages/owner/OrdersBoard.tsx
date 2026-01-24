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
    const { profile } = useAuth();

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Sound notification hook
    const { play: playNotification } = useSound('/notification.mp3', { autoUnlock: true });

    // Real-time subscriptions
    useOrderRealtime({
        orgId: profile?.org_id || '',
        onNewPaidOrder: (order) => {
            // Add new order to the list
            setOrders(prev => [order, ...prev]);

            // Play notification sound
            playNotification();

            // Show toast
            setToastMessage(`🔔 New paid order #${order.order_number}!`);
        },
        onOrderUpdate: (updatedOrder) => {
            // Update existing order in the list
            setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        },
    });

    // Group orders by status
    const { incoming, preparing, ready, completed } = useMemo(() => {
        return {
            incoming: orders.filter(o => o.status === 'paid'),
            preparing: orders.filter(o => o.status === 'accepted' || o.status === 'preparing'),
            ready: orders.filter(o => o.status === 'ready'),
            completed: orders.filter(o => o.status === 'completed'),
        };
    }, [orders]);

    // Fetch orders on mount
    useEffect(() => {
        if (!profile?.org_id) return;

        const fetchOrders = async () => {
            try {
                setLoading(true);
                const response = await api.listOrders({
                    orgId: profile.org_id,
                    statuses: ['paid', 'accepted', 'preparing', 'ready', 'completed'],
                    limit: 100,
                });
                setOrders(response.orders);
            } catch (err: any) {
                setError(err.message || 'Failed to load orders');
                console.error('Error fetching orders:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [profile?.org_id]);

    // Handle quick actions
    const handleQuickAction = useCallback(async (order: Order, nextStatus: OrderStatus) => {
        try {
            const updatedOrder = await api.updateOrderStatus(order.id, nextStatus);

            // Update local state
            setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));

            setToastMessage(`Order #${order.order_number} updated to ${nextStatus}`);
        } catch (err: any) {
            setToastMessage(`Error: ${err.message}`);
            console.error('Error updating order:', err);
        }
    }, []);

    const handleOrderClick = (order: Order) => {
        navigate(`/owner/orders/${order.id}`);
    };

    if (loading) {
        return (
            <OwnerLayout>
                <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                    <div className="text-white text-center">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-sm opacity-60">Loading orders...</p>
                    </div>
                </div>
            </OwnerLayout>
        );
    }

    if (error && orders.length === 0) {
        return (
            <OwnerLayout>
                <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                    <div className="text-center">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-primary hover:bg-accent text-white px-6 py-2 rounded-lg transition-colors"
                        >
                            Retry
                        </button>
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
                        onQuickAction={(order) => handleQuickAction(order, 'accepted')}
                        quickActionLabel="Accept"
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
