import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { OrdersLane } from '../../components/owner/OrdersLane';
import { BrandedLoader } from '../../components/owner/BrandedLoader';
import { Toast } from '../../components/Toast';
import { useSound } from '../../hooks/useSound';
import { useOrderRealtime } from '../../hooks/useOrderRealtime';
import type { Order, OrderStatus } from '../../types';
import { api } from '../../lib/api';
import { Trash2, X, CheckSquare, Square } from 'lucide-react';

type ViewMode = 'board' | 'list';
type DateFilter = 'today' | '7d' | '30d' | 'all';

export const OrdersBoard: React.FC = () => {
    const navigate = useNavigate();
    const { profile, session, signOut } = useAuth();
    const { activeWorkspace } = useWorkspace();
    const slug = activeWorkspace?.slug || '';

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState<DateFilter>('today');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const isSelecting = selectedIds.size > 0;

    // Sound notification hook
    const { play: playNotification } = useSound('/notification.mp3', { autoUnlock: true });

    // Real-time subscriptions
    useOrderRealtime({
        orgId: profile?.org_id || '',
        onNewPaidOrder: async (partialOrder) => {
            try {
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
                const fullOrder = await api.getOrder(partialOrder.id);
                setOrders(prev => prev.map(o => o.id === fullOrder.id ? fullOrder : o));
            } catch (err) {
                console.error('Failed to fetch updated order details:', err);
            }
        },
    });

    // Date filter logic
    const filteredOrders = useMemo(() => {
        if (dateFilter === 'all') return orders;
        const now = new Date();
        const cutoff = new Date();
        if (dateFilter === 'today') {
            cutoff.setHours(0, 0, 0, 0);
        } else if (dateFilter === '7d') {
            cutoff.setDate(now.getDate() - 7);
        } else if (dateFilter === '30d') {
            cutoff.setDate(now.getDate() - 30);
        }
        return orders.filter(o => new Date(o.created_at) >= cutoff);
    }, [orders, dateFilter]);

    // Group orders by status
    const { incoming, preparing, ready, completed } = useMemo(() => {
        return {
            incoming: filteredOrders.filter(o => o.status === 'accepted' || o.status === 'paid'),
            preparing: filteredOrders.filter(o => o.status === 'preparing'),
            ready: filteredOrders.filter(o => o.status === 'ready'),
            completed: filteredOrders.filter(o => o.status === 'completed'),
        };
    }, [filteredOrders]);

    // Fetch orders on mount
    useEffect(() => {
        let isMounted = true;
        let timeoutId: NodeJS.Timeout;

        if (!session) {
            navigate('/login');
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
            setToastMessage(`Order #${order.order_number} → ${nextStatus}`);
        } catch (err: any) {
            setToastMessage(`Error: ${err.message}`);
        }
    }, []);

    const handleOrderClick = (order: Order) => {
        if (isSelecting) {
            toggleSelect(order.id);
            return;
        }
        navigate(`/app/${slug}/orders/${order.id}`);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedIds.size === filteredOrders.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredOrders.map(o => o.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        setDeleting(true);
        try {
            const ids = Array.from(selectedIds);
            await api.bulkDeleteOrders(ids);
            setOrders(prev => prev.filter(o => !selectedIds.has(o.id)));
            setToastMessage(`Deleted ${ids.length} order(s)`);
            setSelectedIds(new Set());
        } catch (err: any) {
            setToastMessage(`Delete failed: ${err.message}`);
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleRetry = () => window.location.reload();
    const handleLogout = async () => { try { await signOut(); navigate('/login'); } catch { } };

    if (loading) {
        return (
            <OwnerLayout>
                <BrandedLoader
                    fullPage
                    message={!profile?.org_id ? 'Loading your dashboard…' : 'Loading orders…'}
                />
            </OwnerLayout>
        );
    }

    if (error && orders.length === 0) {
        return (
            <OwnerLayout>
                <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                    <div className="text-center max-w-md">
                        <p className="text-red-500 mb-6">{error}</p>
                        <div className="flex gap-4 justify-center">
                            <button onClick={handleRetry} className="bg-primary hover:bg-accent text-white px-6 py-2 rounded-xl transition-colors">Retry</button>
                            <button onClick={handleLogout} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-xl transition-colors">Logout</button>
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
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-text text-2xl font-bold mb-1">Orders</h1>
                        <p className="text-muted text-sm">
                            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} · Manage incoming orders and track progress
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Date Filter */}
                        <div className="flex bg-surface-2 border border-border rounded-xl overflow-hidden">
                            {(['today', '7d', '30d', 'all'] as DateFilter[]).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setDateFilter(f)}
                                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${dateFilter === f
                                        ? 'bg-primary text-white'
                                        : 'text-muted hover:text-text'
                                    }`}
                                >
                                    {f === 'today' ? 'Today' : f === '7d' ? '7 days' : f === '30d' ? '30 days' : 'All'}
                                </button>
                            ))}
                        </div>

                        {/* Select / Delete Actions */}
                        {isSelecting ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={selectAll}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted hover:text-text bg-surface-2 border border-border rounded-xl transition-colors"
                                >
                                    {selectedIds.size === filteredOrders.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                    {selectedIds.size === filteredOrders.length ? 'Deselect all' : 'Select all'}
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    disabled={deleting}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete {selectedIds.size}
                                </button>
                                <button
                                    onClick={() => setSelectedIds(new Set())}
                                    className="p-1.5 text-muted hover:text-text rounded-lg transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => selectAll()}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted hover:text-text bg-surface-2 border border-border rounded-xl transition-colors"
                            >
                                <Square className="w-3.5 h-3.5" />
                                Select
                            </button>
                        )}
                    </div>
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
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect}
                        isSelecting={isSelecting}
                    />

                    <OrdersLane
                        title="Preparing"
                        orders={preparing}
                        emptyMessage="No orders in prep"
                        onOrderClick={handleOrderClick}
                        onQuickAction={(order) => handleQuickAction(order, 'ready')}
                        quickActionLabel="Mark Ready"
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect}
                        isSelecting={isSelecting}
                    />

                    <OrdersLane
                        title="Ready"
                        orders={ready}
                        emptyMessage="No orders ready"
                        onOrderClick={handleOrderClick}
                        onQuickAction={(order) => handleQuickAction(order, 'completed')}
                        quickActionLabel="Complete"
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect}
                        isSelecting={isSelecting}
                    />

                    <OrdersLane
                        title="Completed"
                        orders={completed}
                        emptyMessage="No completed orders"
                        onOrderClick={handleOrderClick}
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect}
                        isSelecting={isSelecting}
                    />
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 max-w-sm w-full mx-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Delete orders?</h3>
                        <p className="text-gray-500 text-sm mb-6">
                            This will permanently delete {selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''}. This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={deleting}
                                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50"
                            >
                                {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toastMessage && (
                <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
            )}
        </OwnerLayout>
    );
};
