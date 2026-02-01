import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { api } from '../../lib/api';
import type { CustomerDetails, Order } from '../../types';

export const CustomerDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [customer, setCustomer] = useState<CustomerDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            fetchCustomerDetails(id);
        }
    }, [id]);

    const fetchCustomerDetails = async (customerId: string) => {
        try {
            setLoading(true);
            const data = await api.getCustomerDetails(customerId);
            setCustomer(data);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching customer details:', err);
            setError(err.message || 'Failed to load customer details');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-400';
            case 'canceled': return 'text-red-400';
            case 'preparing': return 'text-blue-400';
            default: return 'text-yellow-400';
        }
    };

    if (loading) {
        return (
            <OwnerLayout>
                <div className="p-6 flex items-center justify-center min-h-[50vh]">
                    <div className="text-white/60">Loading customer details...</div>
                </div>
            </OwnerLayout>
        );
    }

    if (error || !customer) {
        return (
            <OwnerLayout>
                <div className="p-6 text-center">
                    <div className="text-red-400 mb-4">{error || 'Customer not found'}</div>
                    <button
                        onClick={() => navigate('/owner/customers')}
                        className="text-primary hover:underline"
                    >
                        ← Back to Customers
                    </button>
                </div>
            </OwnerLayout>
        );
    }

    return (
        <OwnerLayout>
            <div className="p-6 max-w-7xl mx-auto">
                {/* Header with Back Button */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate('/owner/customers')}
                        className="text-white/40 hover:text-white mb-4 flex items-center gap-2 transition-colors"
                    >
                        <span>←</span> Back to Customers
                    </button>
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-bold text-3xl">
                                {customer.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-1">{customer.name}</h1>
                            <div className="flex flex-wrap gap-4 items-center mt-2">
                                {customer.email && (
                                    <span className="text-white/60 flex items-center gap-2">
                                        📧 {customer.email}
                                    </span>
                                )}
                                {customer.phone && (
                                    <span className="text-white/60 flex items-center gap-2">
                                        📱 {customer.phone}
                                    </span>
                                )}
                                <span className="text-white/40">
                                    Customer since {new Date(customer.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Stats and Info */}
                    <div className="space-y-6">
                        {/* Highlights Card */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4">Insights</h2>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Total Lifetime Value</div>
                                    <div className="text-2xl font-bold text-green-400">{formatCurrency(customer.total_spent_cents)}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Orders</div>
                                        <div className="text-xl font-bold text-white">{customer.total_orders}</div>
                                    </div>
                                    <div>
                                        <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Avg Ticket</div>
                                        <div className="text-xl font-bold text-white">{formatCurrency(customer.average_order_cents)}</div>
                                    </div>
                                </div>
                                {customer.last_order_at && (
                                    <div>
                                        <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Last Order</div>
                                        <div className="text-white font-medium">
                                            {new Date(customer.last_order_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Favorite Items Card */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4">Top Items</h2>
                            {customer.favorite_items && customer.favorite_items.length > 0 ? (
                                <div className="space-y-3">
                                    {customer.favorite_items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center">
                                            <span className="text-white/80">{item.name}</span>
                                            <span className="bg-white/10 text-white/40 text-xs px-2 py-1 rounded">
                                                {item.count} orders
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-white/40 text-sm">No data yet</div>
                            )}
                        </div>

                        {/* Saved Addresses Card */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-white">Addresses</h2>
                                <span className="text-white/40 text-xs">{customer.addresses.length} total</span>
                            </div>
                            {customer.addresses.length > 0 ? (
                                <div className="space-y-4">
                                    {customer.addresses.map((addr) => (
                                        <div key={addr.id} className="border-l-2 border-primary/40 pl-4 py-1">
                                            <div className="text-white font-medium text-sm">
                                                {addr.label || 'Standard Address'}
                                            </div>
                                            <div className="text-white/60 text-xs mt-1">
                                                {addr.street}, {addr.city}, {addr.region} {addr.postal_code}
                                            </div>
                                            <div className="text-white/40 text-[10px] uppercase mt-2">
                                                Used {addr.use_count} times
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-white/40 text-sm italic">No delivery addresses on record</div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Order History */}
                    <div className="lg:col-span-2">
                        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                <h2 className="text-lg font-bold text-white">Order History</h2>
                                <span className="text-white/40 text-sm">Showing last 20 orders</span>
                            </div>

                            {customer.recent_orders.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/5">
                                                <th className="px-6 py-4 font-medium">Order #</th>
                                                <th className="px-6 py-4 font-medium">Date</th>
                                                <th className="px-6 py-4 font-medium">Fulfillment</th>
                                                <th className="px-6 py-4 font-medium">Status</th>
                                                <th className="px-6 py-4 font-medium text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {customer.recent_orders.map((order) => (
                                                <tr
                                                    key={order.id}
                                                    className="hover:bg-white/5 cursor-pointer transition-colors"
                                                    onClick={() => navigate(`/owner/orders/${order.id}`)}
                                                >
                                                    <td className="px-6 py-4 text-white font-medium">#{order.order_number}</td>
                                                    <td className="px-6 py-4 text-white/60 text-sm">
                                                        {new Date(order.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-white/60 text-sm capitalize">
                                                            {order.fulfillment_type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-sm font-medium ${getStatusColor(order.status)}`}>
                                                            {order.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-white font-medium">
                                                        {formatCurrency(order.total * 100)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-12 text-center text-white/40">
                                    No completed orders found for this customer.
                                </div>
                            )}
                        </div>

                        {/* Customer Notes Section */}
                        <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4">Internal Notes & Tags</h2>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {customer.tags && customer.tags.length > 0 ? (
                                    customer.tags.map((tag, i) => (
                                        <span key={i} className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-medium border border-primary/30">
                                            {tag}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-white/20 text-xs italic">No tags assigned</span>
                                )}
                            </div>
                            <div className="text-white/60 text-sm bg-black/20 p-4 rounded-lg min-h-[100px]">
                                {customer.notes || "No internal notes for this customer yet."}
                            </div>
                            <div className="mt-4 flex gap-4">
                                <span className={`flex items-center gap-2 text-xs font-medium ${customer.email_marketing_consent ? 'text-green-400' : 'text-white/30'}`}>
                                    {customer.email_marketing_consent ? '✓ Email Opt-in' : '✗ No Email Marketing'}
                                </span>
                                <span className={`flex items-center gap-2 text-xs font-medium ${customer.sms_marketing_consent ? 'text-green-400' : 'text-white/30'}`}>
                                    {customer.sms_marketing_consent ? '✓ SMS Opt-in' : '✗ No SMS Marketing'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </OwnerLayout>
    );
};
