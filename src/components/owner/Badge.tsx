import React from 'react';
import type { OrderStatus, FulfillmentType, DeliveryStatus, UserRole } from '../../types';

interface BadgeProps {
    variant?: 'status' | 'fulfillment' | 'role' | 'default';
    children: React.ReactNode;
    className?: string;
}

const STATUS_COLORS: Record<OrderStatus, string> = {
    draft: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    awaiting_payment: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    paid: 'bg-green-500/20 text-green-300 border-green-500/30',
    accepted: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    preparing: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    ready: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    out_for_delivery: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    completed: 'bg-green-600/20 text-green-400 border-green-600/30',
    canceled: 'bg-red-500/20 text-red-300 border-red-500/30',
    refunded: 'bg-red-600/20 text-red-400 border-red-600/30',
};

const FULFILLMENT_COLORS: Record<FulfillmentType, string> = {
    pickup: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    delivery: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

const ROLE_COLORS: Record<UserRole, string> = {
    owner: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    manager: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    kitchen: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    admin: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className = '' }) => {
    const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border';

    let colorClasses = 'bg-white/10 text-white/70 border-white/20';

    if (variant === 'status' && typeof children === 'string') {
        colorClasses = STATUS_COLORS[children as OrderStatus] || colorClasses;
    } else if (variant === 'fulfillment' && typeof children === 'string') {
        colorClasses = FULFILLMENT_COLORS[children as FulfillmentType] || colorClasses;
    } else if (variant === 'role' && typeof children === 'string') {
        colorClasses = ROLE_COLORS[children as UserRole] || colorClasses;
    }

    return (
        <span className={`${baseClasses} ${colorClasses} ${className}`}>
            {children}
        </span>
    );
};

// Status badge with friendly labels
interface StatusBadgeProps {
    status: OrderStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const labels: Record<OrderStatus, string> = {
        draft: 'Draft',
        awaiting_payment: 'Awaiting Payment',
        paid: 'Paid',
        accepted: 'Accepted',
        preparing: 'Preparing',
        ready: 'Ready',
        out_for_delivery: 'Out for Delivery',
        completed: 'Completed',
        canceled: 'Canceled',
        refunded: 'Refunded',
    };

    return (
        <Badge variant="status">
            {labels[status]}
        </Badge>
    );
};
