import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { StatusBadge } from '../../components/owner/Badge';
import { StatusStepper } from '../../components/owner/StatusStepper';
import { DeliveryPanel } from '../../components/owner/DeliveryPanel';
import { ChevronLeft } from '../../components/Icons';
import type { Order } from '../../types';
import { api } from '../../lib/api';

export const OrderDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        const fetchOrder = async () => {
            try {
                setLoading(true);
                const orderData = await api.getOrder(id);
                setOrder(orderData);
            } catch (err: any) {
                setError(err.message || 'Failed to load order');
                console.error('Error fetching order:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [id]);

    const handleStatusChange = (newStatus: any) => {
        if (order) {
            setOrder({ ...order, status: newStatus });
        }
    };

    if (loading) {
        return (
            <OwnerLayout>
                <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                    <div className="text-white text-center">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-sm opacity-60">Loading order...</p>
                    </div>
                </div>
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
                            onClick={() => navigate('/owner')}
                            className="bg-primary hover:bg-accent text-white px-6 py-2 rounded-lg transition-colors"
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
                    onClick={() => navigate('/owner')}
                    className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Back to Orders</span>
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Header */}
                        <div className="bg-neutral-800 border border-white/10 rounded-xl p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h1 className="text-white text-3xl font-bold mb-2">Order #{order.order_number}</h1>
                                    <p className="text-white/60 text-sm">
                                        Placed {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                                    </p>
                                </div>
                                <StatusBadge status={order.status} />
                            </div>

                            {/* Customer Info */}
                            <div className="border-t border-white/10 pt-4">
                                <h3 className="text-white font-semibold mb-3">Customer</h3>
                                <p className="text-white text-lg">{order.customer_name}</p>
                                <a
                                    href={`tel:${order.customer_phone}`}
                                    className="text-primary hover:underline text-sm"
                                >
                                    {order.customer_phone}
                                </a>
                                <p className="text-white/60 text-sm mt-1">{order.customer_email}</p>
                            </div>

                            {/* Fulfillment Type */}
                            <div className="border-t border-white/10 pt-4 mt-4">
                                <span className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold ${order.fulfillment_type === 'delivery'
                                        ? 'bg-purple-500/20 text-purple-300'
                                        : 'bg-blue-500/20 text-blue-300'
                                    }`}>
                                    {order.fulfillment_type === 'delivery' ? '🚚 Delivery' : '🏃 Pickup'}
                                </span>
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="bg-neutral-800 border border-white/10 rounded-xl p-6">
                            <h3 className="text-white font-semibold text-lg mb-4">Order Items</h3>
                            <div className="space-y-4">
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-start border-b border-white/5 pb-4 last:border-0 last:pb-0">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <span className="bg-white/10 text-white font-bold text-sm w-8 h-8 rounded-full flex items-center justify-center">
                                                    {item.quantity}
                                                </span>
                                                <span className="text-white font-medium text-lg">{item.name}</span>
                                            </div>
                                            {item.modifiers && item.modifiers.length > 0 && (
                                                <p className="text-white/60 text-sm ml-11 mt-1">
                                                    {item.modifiers.join(', ')}
                                                </p>
                                            )}
                                            {item.notes && (
                                                <p className="text-white/40 text-xs ml-11 mt-1 italic">
                                                    Note: {item.notes}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-white font-semibold text-lg">
                                            ${(item.price * item.quantity).toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Totals */}
                            <div className="border-t border-white/10 mt-6 pt-4 space-y-2">
                                <div className="flex justify-between text-white/60 text-sm">
                                    <span>Subtotal</span>
                                    <span>${order.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-white/60 text-sm">
                                    <span>Tax</span>
                                    <span>${order.tax.toFixed(2)}</span>
                                </div>
                                {order.tip > 0 && (
                                    <div className="flex justify-between text-white/60 text-sm">
                                        <span>Tip</span>
                                        <span>${order.tip.toFixed(2)}</span>
                                    </div>
                                )}
                                {order.delivery_fee > 0 && (
                                    <div className="flex justify-between text-white/60 text-sm">
                                        <span>Delivery Fee</span>
                                        <span>${order.delivery_fee.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-white font-bold text-xl pt-2 border-t border-white/10">
                                    <span>Total</span>
                                    <span>${order.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Special Instructions */}
                        {order.special_instructions && (
                            <div className="bg-neutral-800 border border-white/10 rounded-xl p-6">
                                <h3 className="text-white font-semibold mb-2">Special Instructions</h3>
                                <p className="text-white/80">{order.special_instructions}</p>
                            </div>
                        )}

                        {/* Delivery Panel */}
                        {order.fulfillment_type === 'delivery' && <DeliveryPanel order={order} />}
                    </div>

                    {/* Sidebar - Actions */}
                    <div className="space-y-6">
                        <div className="bg-neutral-800 border border-white/10 rounded-xl p-6 sticky top-20">
                            <h3 className="text-white font-semibold mb-4">Actions</h3>
                            <StatusStepper
                                currentStatus={order.status}
                                orderId={order.id}
                                onStatusChange={handleStatusChange}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </OwnerLayout>
    );
};
