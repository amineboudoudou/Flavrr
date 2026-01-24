import React, { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { Order } from '../../types';
import { StatusBadge } from './Badge';

interface OrderCardProps {
    order: Order;
    onClick: () => void;
    onQuickAction?: () => void;
    quickActionLabel?: string;
}

export const OrderCard = React.memo<OrderCardProps>(({ order, onClick, onQuickAction, quickActionLabel }) => {
    // "New" glow if order is less than 60 seconds old
    const isNew = useMemo(() => {
        const now = new Date().getTime();
        const createdAt = new Date(order.created_at).getTime();
        return (now - createdAt) < 60000; // 60 seconds
    }, [order.created_at]);

    // Format time
    const timeAgo = useMemo(() => {
        try {
            return formatDistanceToNow(new Date(order.created_at), { addSuffix: true });
        } catch {
            return new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }, [order.created_at]);

    // Truncate items preview
    const itemsPreview = useMemo(() => {
        const items = order.items.slice(0, 3).map(item => `${item.name} x${item.quantity}`).join(', ');
        return order.items.length > 3 ? `${items}...` : items;
    }, [order.items]);

    return (
        <div
            className={`bg-neutral-800 border rounded-xl p-4 cursor-pointer transition-all hover:border-primary/50 ${isNew
                    ? 'border-primary/50 animate-pulse-glow'
                    : 'border-white/10'
                }`}
            onClick={onClick}
        >
            {/* Header: Order # + Time */}
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h4 className="text-white font-semibold text-lg">#{order.order_number}</h4>
                    <p className="text-white/40 text-xs">{timeAgo}</p>
                </div>

                {/* Fulfillment Badge */}
                <span className={`text-xs font-semibold px-2 py-1 rounded ${order.fulfillment_type === 'delivery'
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                    {order.fulfillment_type === 'delivery' ? '🚚 Delivery' : '🏃 Pickup'}
                </span>
            </div>

            {/* Customer Info */}
            <div className="mb-3">
                <p className="text-white text-sm font-medium">{order.customer_name}</p>
                <a
                    href={`tel:${order.customer_phone}`}
                    className="text-primary text-xs hover:underline"
                    onClick={(e) => e.stopPropagation()}
                >
                    {order.customer_phone}
                </a>
            </div>

            {/* Items Preview */}
            <p className="text-white/60 text-xs mb-3 line-clamp-2">{itemsPreview}</p>

            {/* Total */}
            <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <span className="text-white font-bold text-lg">${order.total.toFixed(2)}</span>

                {/* Quick Action Button */}
                {onQuickAction && quickActionLabel && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onQuickAction();
                        }}
                        className="bg-primary hover:bg-accent text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                        {quickActionLabel}
                    </button>
                )}
            </div>

            {/* "New" Indicator */}
            {isNew && (
                <div className="absolute top-2 right-2">
                    <span className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">
                        NEW
                    </span>
                </div>
            )}
        </div>
    );
});

OrderCard.displayName = 'OrderCard';
