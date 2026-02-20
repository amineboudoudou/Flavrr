import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { BrandedLoader } from '../../components/owner/BrandedLoader';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { Customer } from '../../types';

export const Customers: React.FC = () => {
    const { activeWorkspace } = useWorkspace();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'total_spent' | 'order_count' | 'last_order_at'>('last_order_at');
    const [exporting, setExporting] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchCustomers();
    }, [search, sortBy]);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const data = await api.listCustomers({
                search: search || undefined,
                sort: sortBy,
            });
            setCustomers(data.customers);
        } catch (error) {
            console.error('Error fetching customers:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (cents: number) => {
        return `$${(cents / 100).toFixed(2)}`;
    };

    const getCustomerName = (customer: Customer) => {
        if (customer.first_name || customer.last_name) {
            return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
        }
        return customer.email || 'Unknown';
    };

    const handleExportCSV = async () => {
        try {
            setExporting(true);
            const data = await api.exportMarketingCustomers();
            
            // Convert to CSV
            const headers = ['Email', 'First Name', 'Last Name', 'Phone', 'Last Order', 'Total Orders'];
            const rows = data.customers.map((c: any) => [
                c.email,
                c.first_name || '',
                c.last_name || '',
                c.phone || '',
                c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : '',
                c.total_orders
            ]);
            
            const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `marketing-customers-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export customers');
        } finally {
            setExporting(false);
        }
    };

    return (
        <OwnerLayout>
            <div className="p-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-text mb-2">Customers</h1>
                    <p className="text-muted">View and manage your customer base</p>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <input
                        type="text"
                        placeholder="Search by name, email, or phone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 px-4 py-3 bg-surface border border-border rounded-[var(--radius)] text-text placeholder:text-muted focus:outline-none focus:border-primary shadow-[var(--shadow)]"
                    />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="px-4 py-3 bg-surface border border-border rounded-[var(--radius)] text-text focus:outline-none focus:border-primary shadow-[var(--shadow)]"
                    >
                        <option value="last_order_at">Recent Orders</option>
                        <option value="total_spent">Total Spent</option>
                        <option value="order_count">Order Count</option>
                    </select>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-[var(--radius)] font-medium transition-colors flex items-center gap-2 shadow-[var(--shadow)]"
                    >
                        <Plus className="w-4 h-4" />
                        Add Customer
                    </button>
                    <button
                        onClick={handleExportCSV}
                        disabled={exporting}
                        className="px-6 py-3 bg-primary hover:bg-accent text-white rounded-[var(--radius)] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-[var(--shadow)]"
                    >
                        {exporting ? 'Exporting...' : 'Export Marketing CSV'}
                    </button>
                </div>

                {/* Customers List */}
                {loading ? (
                    <div className="py-12">
                        <BrandedLoader message="Loading customers…" />
                    </div>
                ) : customers.length === 0 ? (
                    <div className="text-center py-12 text-muted">No customers found</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {customers.map((customer) => (
                            <div
                                key={customer.id}
                                onClick={() => navigate(`/owner/customers/${customer.id}`)}
                                className="bg-surface border border-border rounded-[var(--radius)] p-6 hover:bg-surface-2 hover:border-primary/40 cursor-pointer transition-all active:scale-[0.98] shadow-[var(--shadow)]"
                            >
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center flex-shrink-0">
                                        <span className="text-primary font-bold text-lg">
                                            {(customer.first_name || customer.email || 'U').charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-text font-medium truncate">{getCustomerName(customer)}</h3>
                                            {customer.marketing_opt_in && (
                                                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full border border-primary/20 whitespace-nowrap">
                                                    Opted-in
                                                </span>
                                            )}
                                        </div>
                                        {customer.email && (
                                            <p className="text-muted text-sm truncate">{customer.email}</p>
                                        )}
                                        {customer.phone && (
                                            <p className="text-muted text-sm">{customer.phone}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted text-sm">Total Orders</span>
                                        <span className="text-text font-medium">{customer.total_orders}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted text-sm">Total Spent</span>
                                        <span className="text-text font-medium">
                                            {formatCurrency(customer.total_spent_cents)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted text-sm">Avg Order</span>
                                        <span className="text-text font-medium">
                                            {formatCurrency(customer.average_order_cents)}
                                        </span>
                                    </div>
                                    {customer.last_order_at && (
                                        <div className="flex justify-between items-center pt-2 border-t border-border">
                                            <span className="text-muted text-sm">Last Order</span>
                                            <span className="text-text text-sm">
                                                {new Date(customer.last_order_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create Customer Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
                        <CreateCustomerModal 
                            onClose={() => setShowCreateModal(false)} 
                            onCustomerCreated={() => {
                                fetchCustomers();
                                setShowCreateModal(false);
                            }}
                            workspaceId={activeWorkspace?.id || ''}
                        />
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
};

// Create Customer Modal Component
const CreateCustomerModal: React.FC<{ onClose: () => void; onCustomerCreated: () => void; workspaceId: string }> = ({ onClose, onCustomerCreated, workspaceId }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState({ street: '', city: '', region: '', postal_code: '', country: 'CA' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            if (!workspaceId) throw new Error('No workspace found');

            const { error } = await supabase
                .from('customers')
                .insert({
                    workspace_id: workspaceId,
                    name: name.trim(),
                    email: email.trim() || null,
                    phone: phone.trim() || null,
                    address: address.street ? JSON.stringify(address) : null,
                    first_order_at: new Date().toISOString(),
                    last_order_at: new Date().toISOString(),
                    total_orders: 0,
                    total_spent_cents: 0,
                });

            if (error) throw error;
            
            onCustomerCreated();
        } catch (error: any) {
            alert('Error creating customer: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Add New Customer</h2>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500"
                        placeholder="Customer name"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500"
                        placeholder="email@example.com"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500"
                        placeholder="(555) 123-4567"
                    />
                </div>

                <div className="border-t pt-4 mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Address (Optional)</label>
                    <input
                        type="text"
                        value={address.street}
                        onChange={(e) => setAddress({ ...address, street: e.target.value })}
                        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500 mb-2"
                        placeholder="Street address"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            type="text"
                            value={address.city}
                            onChange={(e) => setAddress({ ...address, city: e.target.value })}
                            className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500"
                            placeholder="City"
                        />
                        <input
                            type="text"
                            value={address.region}
                            onChange={(e) => setAddress({ ...address, region: e.target.value })}
                            className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500"
                            placeholder="Province/State"
                        />
                    </div>
                    <input
                        type="text"
                        value={address.postal_code}
                        onChange={(e) => setAddress({ ...address, postal_code: e.target.value })}
                        className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500 mt-2"
                        placeholder="Postal Code"
                    />
                </div>

                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !name.trim()}
                        className="flex-1 py-3 bg-pink-500 text-white rounded-xl font-medium hover:bg-pink-600 disabled:opacity-50"
                    >
                        {loading ? 'Creating...' : 'Create Customer'}
                    </button>
                </div>
            </form>
        </div>
    );
};
