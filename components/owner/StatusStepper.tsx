import React, { useState, useCallback } from 'react';
import type { OrderStatus, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';

interface StatusStepperProps {
    currentStatus: OrderStatus;
    orderId: string;
    onStatusChange: (newStatus: OrderStatus) => void;
}

export const StatusStepper: React.FC<StatusStepperProps> = ({
    currentStatus,
    orderId,
    onStatusChange
}) => {
    const { profile } = useAuth();
    const [updating, setUpdating] = useState(false);

    const handleStatusChange = useCallback(async (newStatus: OrderStatus) => {
        setUpdating(true);
        try {
            const updatedOrder = await api.updateOrderStatus(orderId, newStatus);
            onStatusChange(updatedOrder.status);
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update order status');
        } finally {
            setUpdating(false);
        }
    }, [orderId, onStatusChange]);

    // Role-based button visibility
    const canAccept = profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'admin';
    const canPrepare = true; // All roles can prepare
    const canComplete = profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'admin';
    const canRefund = profile?.role === 'admin';

    return (
        <div className="space-y-3">
            {/* Accept Order */}
            {currentStatus === 'paid' && canAccept && (
                <button
                    onClick={() => handleStatusChange('accepted')}
                    disabled={updating}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-lg transition-colors disabled:opacity-50 text-lg"
                >
                    {updating ? 'Updating...' : '✅ Accept Order'}
                </button>
            )}

            {/* Start Prep */}
            {currentStatus === 'accepted' && canPrepare && (
                <button
                    onClick={() => handleStatusChange('preparing')}
                    disabled={updating}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-4 rounded-lg transition-colors disabled:opacity-50 text-lg"
                >
                    {updating ? 'Updating...' : '👨‍🍳 Start Prep'}
                </button>
            )}

            {/* Mark Ready */}
            {currentStatus === 'preparing' && canPrepare && (
                <button
                    onClick={() => handleStatusChange('ready')}
                    disabled={updating}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 rounded-lg transition-colors disabled:opacity-50 text-lg"
                >
                    {updating ? 'Updating...' : '🔔 Mark Ready'}
                </button>
            )}

            {/* Complete */}
            {currentStatus === 'ready' && canComplete && (
                <button
                    onClick={() => handleStatusChange('completed')}
                    disabled={updating}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-lg transition-colors disabled:opacity-50 text-lg"
                >
                    {updating ? 'Updating...' : '✨ Complete'}
                </button>
            )}

            {/* Refund (Admin Only) */}
            {(currentStatus === 'completed' || currentStatus === 'ready') && canRefund && (
                <button
                    onClick={() => {
                        if (confirm('Are you sure you want to refund this order?')) {
                            handleStatusChange('refunded');
                        }
                    }}
                    disabled={updating}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-4 rounded-lg transition-colors disabled:opacity-50 text-lg"
                >
                    {updating ? 'Processing...' : '💸 Refund Order'}
                </button>
            )}
        </div>
    );
};
