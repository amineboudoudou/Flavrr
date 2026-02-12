import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { BrandedLoader } from '../../components/owner/BrandedLoader';
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

    const getCustomerName = (c: CustomerDetails) => {
        if ((c as any).first_name || (c as any).last_name) {
            return `${(c as any).first_name || ''} ${(c as any).last_name || ''}`.trim();
        }
        return c.email || 'Customer';
    };

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
                    <BrandedLoader message="Loading customer details…" />
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
                        className="text-muted hover:text-text mb-4 flex items-center gap-2 transition-colors"
                    >
                        <span>←</span> Back to Customers
                    </button>
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-surface-2 border border-border flex items-center justify-center flex-shrink-0 shadow-[var(--shadow)]">
                            <span className="text-primary font-bold text-3xl">
                                {getCustomerName(customer).charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-text mb-1">{getCustomerName(customer)}</h1>
                            <div className="flex flex-wrap gap-4 items-center mt-2">
                                {customer.email && (
                                    <span className="text-muted flex items-center gap-2">
                                        📧 {customer.email}
                                    </span>
                                )}
                                {customer.phone && (
                                    <span className="text-muted flex items-center gap-2">
                                        📱 {customer.phone}
                                    </span>
                                )}
                                <span className="text-muted">
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
                        <div className="bg-surface border border-border rounded-[var(--radius)] p-6 shadow-[var(--shadow)]">
                            <h2 className="text-lg font-bold text-text mb-4">Insights</h2>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-muted text-xs uppercase tracking-widest mb-1">Total Lifetime Value</div>
                                    <div className="text-2xl font-bold text-text">{formatCurrency(customer.total_spent_cents)}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-muted text-xs uppercase tracking-widest mb-1">Orders</div>
                                        <div className="text-xl font-bold text-text">{customer.total_orders}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted text-xs uppercase tracking-widest mb-1">Avg Ticket</div>
                                        <div className="text-xl font-bold text-text">{formatCurrency(customer.average_order_cents)}</div>
                                    </div>
                                </div>
                                {customer.last_order_at && (
                                    <div>
                                        <div className="text-muted text-xs uppercase tracking-widest mb-1">Last Order</div>
                                        <div className="text-text font-medium">
                                            {new Date(customer.last_order_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Favorite Items Card */}
                        <div className="bg-surface border border-border rounded-[var(--radius)] p-6 shadow-[var(--shadow)]">
                            <h2 className="text-lg font-bold text-text mb-4">Top Items</h2>
                            {(customer as any).favorite_items && (customer as any).favorite_items.length > 0 ? (
                                <div className="space-y-3">
                                    {(customer as any).favorite_items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center">
                                            <span className="text-text">{item.name}</span>
                                            <span className="bg-surface-2 text-muted text-xs px-2 py-1 rounded border border-border">
                                                {item.count} orders
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-muted text-sm">No data yet</div>
                            )}
                        </div>

                        {/* Saved Addresses Card */}
                        <div className="bg-surface border border-border rounded-[var(--radius)] p-6 shadow-[var(--shadow)]">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-text">Addresses</h2>
                                <span className="text-muted text-xs">{customer.addresses.length} total</span>
                            </div>
                            {customer.addresses.length > 0 ? (
                                <div className="space-y-4">
                                    {customer.addresses.map((addr) => (
                                        <div key={addr.id} className="border-l-2 border-primary/40 pl-4 py-1">
                                            <div className="text-text font-medium text-sm">
                                                {addr.label || 'Standard Address'}
                                            </div>
                                            <div className="text-muted text-xs mt-1">
                                                {addr.street}, {addr.city}, {addr.region} {addr.postal_code}
                                            </div>
                                            <div className="text-muted text-[10px] uppercase mt-2">
                                                Used {addr.use_count} times
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-muted text-sm italic">No delivery addresses on record</div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Order History */}
                    <div className="lg:col-span-2">
                        <div className="bg-surface border border-border rounded-[var(--radius)] overflow-hidden shadow-[var(--shadow)]">
                            <div className="p-6 border-b border-border flex justify-between items-center">
                                <h2 className="text-lg font-bold text-text">Order History</h2>
                                <span className="text-muted text-sm">Showing last 20 orders</span>
                            </div>

                            {customer.recent_orders.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-muted text-xs uppercase tracking-wider border-b border-border bg-surface-2">
                                                <th className="px-6 py-4 font-medium">Order #</th>
                                                <th className="px-6 py-4 font-medium">Date</th>
                                                <th className="px-6 py-4 font-medium">Fulfillment</th>
                                                <th className="px-6 py-4 font-medium">Status</th>
                                                <th className="px-6 py-4 font-medium text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {customer.recent_orders.map((order) => (
                                                <tr
                                                    key={order.id}
                                                    className="hover:bg-surface-2 cursor-pointer transition-colors"
                                                    onClick={() => navigate(`/owner/orders/${order.id}`)}
                                                >
                                                    <td className="px-6 py-4 text-text font-medium">#{order.order_number}</td>
                                                    <td className="px-6 py-4 text-muted text-sm">
                                                        {new Date(order.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-muted text-sm capitalize">
                                                            {order.fulfillment_type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-sm font-medium ${getStatusColor(order.status)}`}>
                                                            {order.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-text font-medium">
                                                        {formatCurrency(order.total * 100)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-12 text-center text-muted">
                                    No completed orders found for this customer.
                                </div>
                            )}
                        </div>

                        {/* Customer Notes Section */}
                        <div className="mt-6 bg-surface border border-border rounded-[var(--radius)] p-6 shadow-[var(--shadow)]">
                            <h2 className="text-lg font-bold text-text mb-4">Internal Notes & Tags</h2>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {customer.tags && customer.tags.length > 0 ? (
                                    customer.tags.map((tag, i) => (
                                        <span key={i} className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-medium border border-primary/30">
                                            {tag}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-muted text-xs italic">No tags assigned</span>
                                )}
                            </div>
                            <div className="text-muted text-sm bg-surface-2 p-4 rounded-[var(--radius)] border border-border min-h-[100px]">
                                {customer.notes || "No internal notes for this customer yet."}
                            </div>
                            <div className="mt-4 flex gap-4">
                                <span className={`flex items-center gap-2 text-xs font-medium ${(customer as any).email_marketing_consent ? 'text-green-700' : 'text-muted'}`}>
                                    {(customer as any).email_marketing_consent ? '✓ Email Opt-in' : '✗ No Email Marketing'}
                                </span>
                                <span className={`flex items-center gap-2 text-xs font-medium ${(customer as any).sms_marketing_consent ? 'text-green-700' : 'text-muted'}`}>
                                    {(customer as any).sms_marketing_consent ? '✓ SMS Opt-in' : '✗ No SMS Marketing'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </OwnerLayout>
    );
};
