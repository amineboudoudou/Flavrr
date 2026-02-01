import React, { useState, useCallback } from 'react';
import type { OrderStatus, UserRole, Order } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';

interface StatusStepperProps {
    currentStatus: OrderStatus;
    orderId: string;
    order?: Order;
    onStatusChange: (newStatus: OrderStatus) => void;
    onDeliveryCreated?: (deliveryInfo: any) => void;
}

export const StatusStepper: React.FC<StatusStepperProps> = ({
    currentStatus,
    orderId,
    order,
    onStatusChange,
    onDeliveryCreated
}) => {
    const { profile } = useAuth();
    const [updating, setUpdating] = useState(false);
    const [deliveryError, setDeliveryError] = useState<string | null>(null);

    const handleStatusChange = useCallback(async (newStatus: OrderStatus) => {
        setUpdating(true);
        setDeliveryError(null);
        
        try {
            // Special handling for marking order as "ready" for delivery orders
            if (newStatus === 'ready' && order?.fulfillment_type === 'delivery') {
                console.log('🚚 Creating Uber Direct delivery for order:', orderId);
                
                try {
                    const deliveryInfo = await api.createUberDelivery(orderId, '');
                    console.log('✅ Delivery created:', deliveryInfo);
                    
                    // Notify parent component
                    if (onDeliveryCreated) {
                        onDeliveryCreated(deliveryInfo);
                    }
                    
                    // Status is already updated to 'ready' by the Edge Function
                    onStatusChange('ready');
                } catch (deliveryErr: any) {
                    console.error('❌ Delivery creation failed:', deliveryErr);
                    setDeliveryError(deliveryErr.message || 'Failed to create delivery');
                    
                    // Still update status to ready even if delivery fails
                    const updatedOrder = await api.updateOrderStatus(orderId, newStatus);
                    onStatusChange(updatedOrder.status);
                }
            } else {
                // Normal status update for non-delivery or other statuses
                const updatedOrder = await api.updateOrderStatus(orderId, newStatus);
                onStatusChange(updatedOrder.status);
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update order status');
        } finally {
            setUpdating(false);
        }
    }, [orderId, order, onStatusChange, onDeliveryCreated]);

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
                <>
                    <button
                        onClick={() => handleStatusChange('ready')}
                        disabled={updating}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 rounded-lg transition-colors disabled:opacity-50 text-lg"
                    >
                        {updating ? 'Updating...' : order?.fulfillment_type === 'delivery' ? '🔔 Mark Ready & Request Delivery' : '🔔 Mark Ready'}
                    </button>
                    {deliveryError && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                            <p className="text-red-400 text-sm">⚠️ {deliveryError}</p>
                            <p className="text-red-400/60 text-xs mt-1">Order marked ready, but delivery request failed.</p>
                        </div>
                    )}
                </>
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
