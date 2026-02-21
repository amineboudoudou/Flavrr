import React, { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { Order } from '../../types';
import { StatusBadge } from './Badge';

interface OrderCardProps {
    order: Order;
    onClick: () => void;
    onQuickAction?: () => void;
    quickActionLabel?: string;
    onRevertAction?: () => void;
    revertActionLabel?: string;
    isSelected?: boolean;
    onToggleSelect?: () => void;
    isSelecting?: boolean;
}

export const OrderCard = React.memo<OrderCardProps>(({ order, onClick, onQuickAction, quickActionLabel, onRevertAction, revertActionLabel, isSelected, onToggleSelect, isSelecting }) => {
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
        const items = (order.items || []).slice(0, 3).map(item => `${item.name} x${item.quantity}`).join(', ');
        return (order.items || []).length > 3 ? `${items}...` : items;
    }, [order.items]);

    return (
        <div
            className={`relative bg-surface border rounded-[var(--radius)] p-4 cursor-pointer transition-all hover:border-primary/40 hover:bg-surface-2 shadow-[var(--shadow)] ${isNew
                ? 'border-primary/30'
                : isSelected
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border'
                }`}
            onClick={onClick}
        >
            {/* Selection checkbox */}
            {isSelecting && onToggleSelect && (
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
                    className="absolute top-3 left-3 z-10"
                >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected
                        ? 'bg-primary border-primary'
                        : 'bg-white border-gray-300 hover:border-primary'
                    }`}>
                        {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>
                </button>
            )}

            {/* Header: Order # + Time */}
            <div className={`flex items-start justify-between mb-3 ${isSelecting ? 'pl-7' : ''}`}>
                <div>
                    <h4 className="text-text font-semibold text-lg">
                        #{order.order_number.toString().padStart(4, '0')}
                    </h4>
                    <p className="text-muted text-xs">{timeAgo}</p>
                </div>

                {/* Fulfillment Badge */}
                <span className={`text-xs font-semibold px-2 py-1 rounded-lg border ${order.fulfillment_type === 'delivery'
                    ? 'bg-purple-500/10 text-purple-700 border-purple-200'
                    : 'bg-blue-500/10 text-blue-700 border-blue-200'
                    }`}>
                    {order.fulfillment_type === 'delivery' ? '🚚 Delivery' : '🏃 Pickup'}
                </span>
            </div>

            {/* Customer Info */}
            <div className="mb-3">
                <p className="text-text text-sm font-medium">{order.customer_name}</p>
                <a
                    href={`tel:${order.customer_phone}`}
                    className="text-primary text-xs hover:underline"
                    onClick={(e) => e.stopPropagation()}
                >
                    {order.customer_phone}
                </a>
            </div>

            {/* Items Preview */}
            <p className="text-muted text-xs mb-3 line-clamp-2">{itemsPreview}</p>

            {/* Total & Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-text font-bold text-lg">${(order.total || 0).toFixed(2)}</span>

                <div className="flex items-center gap-2">
                    {/* Revert Action Button */}
                    {onRevertAction && revertActionLabel && !isSelecting && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRevertAction();
                            }}
                            className="bg-gray-500 hover:bg-gray-600 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                        >
                            {revertActionLabel}
                        </button>
                    )}

                    {/* Track Button */}
                    {order.public_token && !isSelecting && (
                        <a
                            href={`/t/${order.public_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                        >
                            Track
                        </a>
                    )}

                    {/* Quick Action Button */}
                    {onQuickAction && quickActionLabel && !isSelecting && (
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
            </div>

            {/* "New" Indicator */}
            {isNew && !isSelecting && (
                <div className="absolute top-2 right-2">
                    <span className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-full">
                        NEW
                    </span>
                </div>
            )}
        </div>
    );
});

OrderCard.displayName = 'OrderCard';
