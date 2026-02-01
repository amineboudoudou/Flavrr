import React, { useState, useEffect } from 'react';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { api } from '../../lib/api';
import type { PromoCode } from '../../types';

export const Promos: React.FC = () => {
    const [promos, setPromos] = useState<PromoCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'active' | 'expired' | 'all'>('active');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [formData, setFormData] = useState({
        code: '',
        description: '',
        discount_type: 'percentage' as 'percentage' | 'fixed_amount',
        discount_value: 10,
        min_order_cents: 0,
        expires_at: '',
    });

    useEffect(() => {
        fetchPromos();
    }, [filter]);

    const fetchPromos = async () => {
        try {
            setLoading(true);
            const data = await api.listPromos({ status: filter });
            setPromos(data.promo_codes);
        } catch (error) {
            console.error('Error fetching promos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createPromo({
                ...formData,
                code: formData.code.toUpperCase(),
            });
            setShowCreateForm(false);
            setFormData({
                code: '',
                description: '',
                discount_type: 'percentage',
                discount_value: 10,
                min_order_cents: 0,
                expires_at: '',
            });
            fetchPromos();
        } catch (error: any) {
            console.error('Error creating promo:', error);
            alert(error.message || 'Failed to create promo code');
        }
    };

    const handleToggleActive = async (promoId: string, isActive: boolean) => {
        try {
            await api.updatePromo(promoId, { is_active: !isActive });
            fetchPromos();
        } catch (error) {
            console.error('Error updating promo:', error);
        }
    };

    const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    return (
        <OwnerLayout>
            <div className="p-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Promo Codes</h1>
                        <p className="text-white/60">Create and manage promotional discounts</p>
                    </div>
                    <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors"
                    >
                        {showCreateForm ? '✕ Cancel' : '+ New Promo'}
                    </button>
                </div>

                {/* Create Form */}
                {showCreateForm && (
                    <form onSubmit={handleCreate} className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-white/80 text-sm font-medium mb-2">Code *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="WELCOME10"
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-white/80 text-sm font-medium mb-2">Description</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="10% off for new customers"
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-white/80 text-sm font-medium mb-2">Discount Type *</label>
                                <select
                                    value={formData.discount_type}
                                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as any })}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                                >
                                    <option value="percentage">Percentage</option>
                                    <option value="fixed_amount">Fixed Amount</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-white/80 text-sm font-medium mb-2">
                                    Discount Value * {formData.discount_type === 'percentage' ? '(%)' : '($)'}
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={formData.discount_value}
                                    onChange={(e) => setFormData({ ...formData, discount_value: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-white/80 text-sm font-medium mb-2">Min Order ($)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.min_order_cents / 100}
                                    onChange={(e) => setFormData({ ...formData, min_order_cents: Math.round(parseFloat(e.target.value) * 100) })}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-white/80 text-sm font-medium mb-2">Expires At</label>
                                <input
                                    type="datetime-local"
                                    value={formData.expires_at}
                                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="mt-4 px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                        >
                            Create Promo Code
                        </button>
                    </form>
                )}

                {/* Filters */}
                <div className="flex gap-2 mb-6">
                    {(['active', 'expired', 'all'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === status
                                    ? 'bg-primary text-white'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Promos List */}
                {loading ? (
                    <div className="text-center py-12 text-white/60">Loading promos...</div>
                ) : promos.length === 0 ? (
                    <div className="text-center py-12 text-white/60">No promo codes found</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {promos.map((promo) => (
                            <div
                                key={promo.id}
                                className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/[0.07] transition-colors"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-2xl font-bold text-primary mb-1">{promo.code}</div>
                                        {promo.description && (
                                            <p className="text-white/60 text-sm">{promo.description}</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleToggleActive(promo.id, promo.is_active)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium ${promo.is_active
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-red-500/20 text-red-400'
                                            }`}
                                    >
                                        {promo.is_active ? 'Active' : 'Inactive'}
                                    </button>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between">
                                        <span className="text-white/60 text-sm">Discount</span>
                                        <span className="text-white font-medium">
                                            {promo.discount_type === 'percentage'
                                                ? `${promo.discount_value}%`
                                                : formatCurrency(promo.discount_value)}
                                        </span>
                                    </div>
                                    {promo.min_order_cents > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-white/60 text-sm">Min Order</span>
                                            <span className="text-white/80 text-sm">{formatCurrency(promo.min_order_cents)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-white/60 text-sm">Uses</span>
                                        <span className="text-white/80 text-sm">
                                            {promo.current_uses} {promo.max_uses ? `/ ${promo.max_uses}` : ''}
                                        </span>
                                    </div>
                                    {promo.expires_at && (
                                        <div className="flex justify-between">
                                            <span className="text-white/60 text-sm">Expires</span>
                                            <span className="text-white/80 text-sm">
                                                {new Date(promo.expires_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {promo.total_discount_given_cents > 0 && (
                                    <div className="pt-4 border-t border-white/10">
                                        <div className="text-white/60 text-xs mb-1">Total Discount Given</div>
                                        <div className="text-green-400 font-bold">{formatCurrency(promo.total_discount_given_cents)}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
};
