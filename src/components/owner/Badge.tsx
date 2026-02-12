import React from 'react';
import type { OrderStatus, FulfillmentType, DeliveryStatus, UserRole } from '../../types';

interface BadgeProps {
    variant?: 'status' | 'fulfillment' | 'role' | 'default';
    children: React.ReactNode;
    className?: string;
}

const STATUS_COLORS: Record<OrderStatus, string> = {
    draft: 'bg-gray-500/10 text-gray-700 border-gray-200',
    awaiting_payment: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
    paid: 'bg-green-500/10 text-green-700 border-green-200',
    accepted: 'bg-blue-500/10 text-blue-700 border-blue-200',
    preparing: 'bg-orange-500/10 text-orange-700 border-orange-200',
    ready: 'bg-purple-500/10 text-purple-700 border-purple-200',
    out_for_delivery: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
    completed: 'bg-green-600/10 text-green-800 border-green-200',
    canceled: 'bg-red-500/10 text-red-700 border-red-200',
    refunded: 'bg-red-600/10 text-red-800 border-red-200',
};

const FULFILLMENT_COLORS: Record<FulfillmentType, string> = {
    pickup: 'bg-blue-500/10 text-blue-700 border-blue-200',
    delivery: 'bg-purple-500/10 text-purple-700 border-purple-200',
};

const ROLE_COLORS: Record<UserRole, string> = {
    owner: 'bg-orange-500/10 text-orange-700 border-orange-200',
    manager: 'bg-purple-500/10 text-purple-700 border-purple-200',
    kitchen: 'bg-blue-500/10 text-blue-700 border-blue-200',
    admin: 'bg-red-500/10 text-red-700 border-red-200',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className = '' }) => {
    const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border';

    let colorClasses = 'bg-surface-2 text-muted border-border';

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
