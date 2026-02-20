import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { BrandedLoader } from '../../components/owner/BrandedLoader';
import { StatusBadge } from '../../components/owner/Badge';
import { StatusStepper } from '../../components/owner/StatusStepper';
import { DeliveryPanel } from '../../components/owner/DeliveryPanel';
import { DeliveryStatus } from '../../components/owner/DeliveryStatus';
import { ChevronLeft } from '../../components/Icons';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { Trash2, ExternalLink } from 'lucide-react';
import type { Order } from '../../types';
import { api } from '../../lib/api';

export const OrderDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { activeWorkspace } = useWorkspace();
    const slug = activeWorkspace?.slug || '';
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOrder = React.useCallback(async () => {
        if (!id) return;
        try {
            // Only set loading on first load to avoid flickering
            if (!order) setLoading(true);
            setError(null);

            const orderData = await api.getOrder(id);

            setOrder(orderData);
        } catch (err: any) {
            // Ignore AbortError as it's common during navigation
            if (err?.name === 'AbortError') {
                console.warn('⚠️ Order fetch aborted (likely navigating away)');
                return;
            }
            setError(err.message || 'Failed to load order');
            console.error('❌ Error fetching order:', err);
        } finally {
            setLoading(false);
        }
    }, [id, order]);

    useEffect(() => {
        fetchOrder();
    }, [id, fetchOrder]); // Added fetchOrder to dependencies

    const handleStatusChange = (newStatus: any) => {
        if (order) {
            setOrder({ ...order, status: newStatus });
            // If status changed to ready and it's delivery, we might want to reload to catch the auto-generated uber_delivery_id
            if (newStatus === 'ready' && order.fulfillment_type === 'delivery') {
                // Short delay to allow backend to finish processing
                setTimeout(() => {
                    fetchOrder();
                }, 1500);
            }
        }
    };

    const handleDeliveryCreated = (deliveryInfo: any) => {
        console.log('✅ Delivery created, updating UI:', deliveryInfo);
        // Update order with delivery info immediately
        if (order) {
            setOrder({
                ...order,
                uber_delivery_id: deliveryInfo.external_id,
                uber_tracking_url: deliveryInfo.tracking_url,
                uber_status: deliveryInfo.status,
                last_uber_sync_at: new Date().toISOString()
            });
        }
    };

    if (loading) {
        return (
            <OwnerLayout>
                <BrandedLoader fullPage message="Loading order…" />
            </OwnerLayout>
        );
    }

    if (error || !order) {
        return (
            <OwnerLayout>
                <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                    <div className="text-center">
                        <p className="text-red-400 mb-4">{error || 'Order not found'}</p>
                        <button
                            onClick={() => navigate(`/app/${slug}/orders`)}
                            className="bg-primary hover:bg-accent text-white px-6 py-2 rounded-xl transition-colors"
                        >
                            Back to Orders
                        </button>
                    </div>
                </div>
            </OwnerLayout>
        );
    }

    return (
        <OwnerLayout>
            <div className="p-4 md:p-6 max-w-6xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={() => navigate(`/app/${slug}/orders`)}
                    className="flex items-center gap-2 text-muted hover:text-text mb-6 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Back to Orders</span>
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Header */}
                        <div className="bg-surface border border-border rounded-[var(--radius)] p-6 shadow-[var(--shadow)]">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h1 className="text-text text-3xl font-bold mb-2">
                                        Order #{order.order_number.toString().padStart(4, '0')}
                                    </h1>
                                    <p className="text-muted text-sm">
                                        Placed {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                                    </p>
                                </div>
                                <StatusBadge status={order.status} />
                            </div>

                            {/* Customer Info */}
                            <div className="border-t border-border pt-4">
                                <h3 className="text-text font-semibold mb-3">Customer</h3>
                                <p className="text-text text-lg">{order.customer_name}</p>
                                <a
                                    href={`tel:${order.customer_phone}`}
                                    className="text-primary hover:underline text-sm"
                                >
                                    {order.customer_phone}
                                </a>
                                <p className="text-muted text-sm mt-1">{order.customer_email}</p>
                            </div>

                            {/* Fulfillment Type */}
                            <div className="border-t border-border pt-4 mt-4">
                                <span className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold ${order.fulfillment_type === 'delivery'
                                    ? 'bg-purple-500/10 text-purple-700 border border-purple-200'
                                    : 'bg-blue-500/10 text-blue-700 border border-blue-200'
                                    }`}>
                                    {order.fulfillment_type === 'delivery' ? '🚚 Delivery' : '🏃 Pickup'}
                                </span>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="bg-surface border border-border rounded-[var(--radius)] p-6 shadow-[var(--shadow)]">
                            <h3 className="text-text font-semibold text-lg mb-4">Order Items</h3>
                            <div className="space-y-4">
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-start border-b border-border pb-4 last:border-0 last:pb-0">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <span className="bg-surface-2 text-text font-bold text-sm w-8 h-8 rounded-full flex items-center justify-center border border-border">
                                                    {item.quantity}
                                                </span>
                                                <span className="text-text font-medium text-lg">{item.name}</span>
                                            </div>
                                            {item.modifiers && item.modifiers.length > 0 && (
                                                <p className="text-muted text-sm ml-11 mt-1">
                                                    {item.modifiers.join(', ')}
                                                </p>
                                            )}
                                            {item.notes && (
                                                <p className="text-muted text-xs ml-11 mt-1 italic">
                                                    Note: {item.notes}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-text font-semibold text-lg">
                                            ${((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Totals */}
                            <div className="border-t border-border mt-6 pt-4 space-y-2">
                                <div className="flex justify-between text-muted text-sm">
                                    <span>Subtotal</span>
                                    <span>${(order.subtotal || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted text-sm">
                                    <span>Tax</span>
                                    <span>${(order.tax || 0).toFixed(2)}</span>
                                </div>
                                {(order.tip || 0) > 0 && (
                                    <div className="flex justify-between text-muted text-sm">
                                        <span>Tip</span>
                                        <span>${(order.tip || 0).toFixed(2)}</span>
                                    </div>
                                )}
                                {(order.delivery_fee || 0) > 0 && (
                                    <div className="flex justify-between text-muted text-sm">
                                        <span>Delivery Fee</span>
                                        <span>${(order.delivery_fee || 0).toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-text font-bold text-xl pt-2 border-t border-border">
                                    <span>Total</span>
                                    <span>${(order.total || 0).toFixed(2)}</span>
                                </div>

                                {/* Stripe Financials */}
                                {(order.stripe_net_amount !== undefined) && (
                                    <div className="pt-4 mt-4 border-t border-border space-y-2">
                                        <div className="flex justify-between text-muted text-xs">
                                            <span>Stripe Fee</span>
                                            <span>-${((order.stripe_fee_amount || 0) / 100).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-green-600 font-bold text-sm">
                                            <span>Est. Payout</span>
                                            <span>${((order.stripe_net_amount || 0) / 100).toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Special Instructions */}
                        {order.special_instructions && (
                            <div className="bg-surface border border-border rounded-[var(--radius)] p-6 shadow-[var(--shadow)]">
                                <h3 className="text-text font-semibold mb-2">Special Instructions</h3>
                                <p className="text-text">{order.special_instructions}</p>
                            </div>
                        )}

                        {/* Delivery Panel */}
                        {order.fulfillment_type === 'delivery' && <DeliveryPanel order={order} onRefresh={fetchOrder} />}
                    </div>

                    {/* Sidebar - Actions */}
                    <div className="space-y-6">
                        <div className="bg-surface border border-border rounded-[var(--radius)] p-6 sticky top-20 shadow-[var(--shadow)]">
                            <h3 className="text-text font-semibold mb-4">Actions</h3>
                            <StatusStepper
                                currentStatus={order.status}
                                orderId={order.id}
                                order={order}
                                onStatusChange={handleStatusChange}
                                onDeliveryCreated={handleDeliveryCreated}
                            />

                            {/* Track Order Button */}
                            {order.public_token && (
                                <a
                                    href={`/t/${order.public_token}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Track Order (Customer View)
                                </a>
                            )}
                        </div>

                        {/* Delivery Status */}
                        <DeliveryStatus order={order} />

                        {/* Delete Order */}
                        <div className="bg-surface border border-border rounded-[var(--radius)] p-6 shadow-[var(--shadow)]">
                            <h3 className="text-text font-semibold mb-2">Danger zone</h3>
                            <p className="text-muted text-sm mb-4">Permanently delete this order and all associated data.</p>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors w-full justify-center"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete order
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 max-w-sm w-full mx-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Delete this order?</h3>
                        <p className="text-gray-500 text-sm mb-6">
                            Order #{order.order_number.toString().padStart(4, '0')} will be permanently deleted. This cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setDeleteLoading(true);
                                    try {
                                        await api.deleteOrder(order.id);
                                        navigate(`/app/${slug}/orders`);
                                    } catch (err: any) {
                                        console.error('Delete failed:', err);
                                        setShowDeleteConfirm(false);
                                    } finally {
                                        setDeleteLoading(false);
                                    }
                                }}
                                disabled={deleteLoading}
                                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50"
                            >
                                {deleteLoading ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </OwnerLayout >
    );
};
