import React from 'react';
import type { Order } from '../../types';
import { OrderCard } from '../../components/owner/OrderCard';

interface OrdersLaneProps {
    title: string;
    orders: Order[];
    emptyMessage?: string;
    onOrderClick: (order: Order) => void;
    onQuickAction?: (order: Order) => void;
    quickActionLabel?: string;
    selectedIds?: Set<string>;
    onToggleSelect?: (id: string) => void;
    isSelecting?: boolean;
}

export const OrdersLane: React.FC<OrdersLaneProps> = ({
    title,
    orders,
    emptyMessage = 'No orders',
    onOrderClick,
    onQuickAction,
    quickActionLabel,
    selectedIds,
    onToggleSelect,
    isSelecting,
}) => {
    return (
        <div className="flex flex-col min-w-[320px] md:min-w-[360px] flex-1">
            {/* Header */}
            <div className="bg-surface border border-border rounded-t-[var(--radius)] px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-[var(--shadow)]">
                <h3 className="text-text font-semibold text-sm">{title}</h3>
                <span className="bg-surface-2 text-muted px-2 py-1 rounded-full text-xs font-bold min-w-[24px] text-center border border-border">
                    {orders.length}
                </span>
            </div>

            {/* Orders List */}
            <div className="bg-surface border-x border-b border-border rounded-b-[var(--radius)] p-3 space-y-3 overflow-y-auto flex-1 min-h-[200px] max-h-[calc(100vh-200px)]">
                {orders.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                        <p className="text-muted text-sm">{emptyMessage}</p>
                    </div>
                ) : (
                    orders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            onClick={() => onOrderClick(order)}
                            onQuickAction={onQuickAction ? () => onQuickAction(order) : undefined}
                            quickActionLabel={quickActionLabel}
                            isSelected={selectedIds?.has(order.id) || false}
                            onToggleSelect={onToggleSelect ? () => onToggleSelect(order.id) : undefined}
                            isSelecting={isSelecting || false}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
