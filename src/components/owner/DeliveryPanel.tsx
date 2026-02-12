import React, { useState, useCallback } from 'react';
import type { Order } from '../../types';
import { api } from '../../lib/api';

interface DeliveryPanelProps {
    order: Order;
    onRefresh?: () => void;
}

export const DeliveryPanel: React.FC<DeliveryPanelProps> = ({ order, onRefresh }) => {
    const [quote, setQuote] = useState<any>(null);
    const [loadingQuote, setLoadingQuote] = useState(false);
    const [creatingDelivery, setCreatingDelivery] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const handleGetQuote = useCallback(async () => {
        setLoadingQuote(true);
        setError(null);

        try {
            const quoteResponse = await api.getUberQuote(order.id);
            setQuote(quoteResponse);
        } catch (err: any) {
            setError(err.message || 'Failed to get quote');
            console.error('Error getting quote:', err);
        } finally {
            setLoadingQuote(false);
        }
    }, [order.id]);

    const handleRequestDriver = useCallback(async () => {
        if (!quote) return;

        setCreatingDelivery(true);
        setError(null);

        try {
            await api.createUberDelivery(order.id, quote.quote_id);
            alert('Driver requested successfully! Tracking info will appear soon.');
            if (onRefresh) onRefresh();
        } catch (err: any) {
            setError(err.message || 'Failed to request driver');
            console.error('Error creating delivery:', err);
        } finally {
            setCreatingDelivery(false);
        }
    }, [order.id, quote, onRefresh]);

    const handleRefresh = async () => {
        if (onRefresh) {
            setRefreshing(true);
            await onRefresh();
            setRefreshing(false);
        }
    };

    if (order.fulfillment_type !== 'delivery') {
        return null; // Only show for delivery orders
    }

    // Guard: Only allow delivery request if order is paid
    if (order.status === 'awaiting_payment' || order.status === 'draft') {
        return (
            <div className="bg-surface border border-border rounded-[var(--radius)] p-6 opacity-60 shadow-[var(--shadow)]">
                <h3 className="text-text font-semibold text-lg mb-2">🚚 Delivery Details</h3>
                <p className="text-muted text-sm">Delivery options will appear once the order is paid.</p>
            </div>
        );
    }

    return (
        <div className="bg-surface border border-border rounded-[var(--radius)] p-6 shadow-[var(--shadow)]">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-text font-semibold text-lg">🚚 Delivery Details</h3>
                {onRefresh && (
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-2 bg-surface-2 hover:bg-surface-2/70 rounded-[var(--radius)] text-muted hover:text-text transition-colors border border-border"
                        title="Refresh Status"
                    >
                        <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Address */}
            {order.delivery_address && (
                <div className="mb-6">
                    <p className="text-muted text-xs uppercase tracking-wider mb-2">Delivery Address</p>
                    <div className="text-text text-sm">
                        <p>{order.delivery_address.street}</p>
                        <p>{order.delivery_address.city}, {order.delivery_address.province} {order.delivery_address.postal_code}</p>
                        {order.delivery_address.special_instructions && (
                            <p className="text-muted mt-2 italic">
                                Note: {order.delivery_address.special_instructions}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Get Quote */}
            {(!order.uber_delivery_id && !quote) && (
                <button
                    onClick={handleGetQuote}
                    disabled={loadingQuote}
                    className="w-full bg-primary hover:bg-accent text-white font-semibold py-3 rounded-[var(--radius)] transition-colors disabled:opacity-50 mb-4 shadow-[var(--shadow)]"
                >
                    {loadingQuote ? 'Getting quote...' : '📝 Get Uber Quote'}
                </button>
            )}

            {/* Show Quote */}
            {quote && !order.uber_delivery_id && (
                <div className="bg-surface-2 border border-border rounded-[var(--radius)] p-4 mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-muted text-sm">Delivery Fee</span>
                        <span className="text-text font-bold text-lg">${quote.fee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted text-sm">Estimated ETA</span>
                        <span className="text-text font-semibold">{quote.eta_minutes} min</span>
                    </div>
                </div>
            )}

            {/* Request Driver */}
            {quote && !order.uber_delivery_id && (
                <button
                    onClick={handleRequestDriver}
                    disabled={creatingDelivery}
                    className="w-full bg-primary hover:bg-accent text-white font-semibold py-3 rounded-[var(--radius)] transition-colors disabled:opacity-50 shadow-[var(--shadow)]"
                >
                    {creatingDelivery ? 'Requesting driver...' : '🚗 Request Uber Driver'}
                </button>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/10 border border-red-200 rounded-[var(--radius)] p-3 mt-4">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Tracking Info */}
            {order.uber_delivery_id ? (
                <div className="mt-6 pt-6 border-t border-border space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-text font-semibold">Status</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${order.uber_status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                                order.uber_status === 'courier_assigned' || order.uber_status === 'pickup_complete' ? 'bg-blue-500/20 text-blue-400' :
                                    'bg-surface-2 text-muted border border-border'
                            }`}>
                            {order.uber_status?.replace(/_/g, ' ') || 'REQUESTED'}
                        </span>
                    </div>

                    {order.uber_tracking_url && (
                        <a
                            href={order.uber_tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-surface-2 hover:bg-surface-2/70 text-text font-medium py-3 rounded-[var(--radius)] transition-colors border border-border"
                        >
                            <span>📍 Track Driver Live</span>
                        </a>
                    )}

                    <div className="text-center">
                        <p className="text-muted text-[10px]">
                            Last synced: {order.last_uber_sync_at ? new Date(order.last_uber_sync_at).toLocaleTimeString() : 'Just now'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="mt-6 text-muted text-xs">
                    <p>💡 Tip: Auto-dispatch triggers when you mark order "Ready". You can also manually request above.</p>
                </div>
            )}
        </div>
    );
};
