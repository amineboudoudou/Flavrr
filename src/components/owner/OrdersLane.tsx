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
}

export const OrdersLane: React.FC<OrdersLaneProps> = ({
    title,
    orders,
    emptyMessage = 'No orders',
    onOrderClick,
    onQuickAction,
    quickActionLabel,
}) => {
    return (
        <div className="flex flex-col min-w-[320px] md:min-w-[360px] flex-1">
            {/* Header */}
            <div className="bg-neutral-800 border border-white/10 rounded-t-xl px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <h3 className="text-white font-semibold text-sm">{title}</h3>
                <span className="bg-white/10 text-white/70 px-2 py-1 rounded-full text-xs font-bold min-w-[24px] text-center">
                    {orders.length}
                </span>
            </div>

            {/* Orders List */}
            <div className="bg-neutral-900/50 border-x border-b border-white/5 rounded-b-xl p-3 space-y-3 overflow-y-auto flex-1 min-h-[200px] max-h-[calc(100vh-200px)]">
                {orders.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                        <p className="text-white/30 text-sm">{emptyMessage}</p>
                    </div>
                ) : (
                    orders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            onClick={() => onOrderClick(order)}
                            onQuickAction={onQuickAction ? () => onQuickAction(order) : undefined}
                            quickActionLabel={quickActionLabel}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
