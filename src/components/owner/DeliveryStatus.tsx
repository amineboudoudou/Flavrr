import React from 'react';
import type { Order } from '../../types';

interface DeliveryStatusProps {
    order: Order;
}

export const DeliveryStatus: React.FC<DeliveryStatusProps> = ({ order }) => {
    if (order.fulfillment_type !== 'delivery') {
        return null;
    }

    const hasDelivery = order.uber_delivery_id || order.uber_tracking_url;

    if (!hasDelivery) {
        return null;
    }

    return (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                🚚 Delivery Information
            </h3>
            
            <div className="space-y-2">
                {/* Delivery Status */}
                {order.uber_status && (
                    <div className="flex items-center justify-between">
                        <span className="text-white/60 text-xs">Status:</span>
                        <span className="text-white text-sm font-medium capitalize">
                            {order.uber_status.replace(/_/g, ' ')}
                        </span>
                    </div>
                )}

                {/* ETA */}
                {order.uber_delivery_id && (
                    <div className="flex items-center justify-between">
                        <span className="text-white/60 text-xs">Delivery ID:</span>
                        <span className="text-white/80 text-xs font-mono">
                            {order.uber_delivery_id.substring(0, 12)}...
                        </span>
                    </div>
                )}

                {/* Tracking Link */}
                {order.uber_tracking_url && (
                    <a
                        href={order.uber_tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full bg-purple-600 hover:bg-purple-700 text-white text-center font-semibold py-2 px-4 rounded-lg transition-colors text-sm mt-3"
                    >
                        📍 Open Tracking
                    </a>
                )}

                {/* Last Sync */}
                {order.last_uber_sync_at && (
                    <div className="text-white/40 text-xs text-center mt-2">
                        Last updated: {new Date(order.last_uber_sync_at).toLocaleTimeString()}
                    </div>
                )}
            </div>
        </div>
    );
};
