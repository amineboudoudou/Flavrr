import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { BrandedLoader } from '../../components/owner/BrandedLoader';
import { api } from '../../lib/api';
import type { Customer } from '../../types';

export const Customers: React.FC = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'total_spent' | 'order_count' | 'last_order_at'>('last_order_at');
    const [exporting, setExporting] = useState(false);
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
            </div>
        </OwnerLayout>
    );
};
