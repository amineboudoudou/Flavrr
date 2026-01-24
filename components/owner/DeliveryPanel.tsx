import React, { useState, useCallback } from 'react';
import type { Order } from '../../types';
import { api } from '../../lib/api';

interface DeliveryPanelProps {
    order: Order;
}

export const DeliveryPanel: React.FC<DeliveryPanelProps> = ({ order }) => {
    const [quote, setQuote] = useState<any>(null);
    const [loadingQuote, setLoadingQuote] = useState(false);
    const [creatingDelivery, setCreatingDelivery] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        } catch (err: any) {
            setError(err.message || 'Failed to request driver');
            console.error('Error creating delivery:', err);
        } finally {
            setCreatingDelivery(false);
        }
    }, [order.id, quote]);

    if (order.fulfillment_type !== 'delivery') {
        return null; // Only show for delivery orders
    }

    return (
        <div className="bg-neutral-800 border border-white/10 rounded-xl p-6">
            <h3 className="text-white font-semibold text-lg mb-4">🚚 Delivery Details</h3>

            {/* Address */}
            {order.delivery_address && (
                <div className="mb-6">
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-2">Delivery Address</p>
                    <div className="text-white text-sm">
                        <p>{order.delivery_address.street}</p>
                        <p>{order.delivery_address.city}, {order.delivery_address.province} {order.delivery_address.postal_code}</p>
                        {order.delivery_address.special_instructions && (
                            <p className="text-white/60 mt-2 italic">
                                Note: {order.delivery_address.special_instructions}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Get Quote */}
            {!quote && (
                <button
                    onClick={handleGetQuote}
                    disabled={loadingQuote}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 mb-4"
                >
                    {loadingQuote ? 'Getting quote...' : '📝 Get Uber Quote'}
                </button>
            )}

            {/* Show Quote */}
            {quote && (
                <div className="bg-black/40 border border-white/10 rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-white/60 text-sm">Delivery Fee</span>
                        <span className="text-white font-bold text-lg">${quote.fee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-white/60 text-sm">Estimated ETA</span>
                        <span className="text-white font-semibold">{quote.eta_minutes} min</span>
                    </div>
                </div>
            )}

            {/* Request Driver */}
            {quote && (
                <button
                    onClick={handleRequestDriver}
                    disabled={creatingDelivery}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
                >
                    {creatingDelivery ? 'Requesting driver...' : '🚗 Request Uber Driver'}
                </button>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mt-4">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Placeholder for delivery tracking */}
            <div className="mt-6 text-white/40 text-xs">
                <p>💡 Tip: Delivery status updates will appear here in real-time once a driver is assigned.</p>
            </div>
        </div>
    );
};
