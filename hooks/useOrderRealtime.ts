import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Order } from '../types';

interface UseOrderRealtimeOptions {
    orgId: string;
    onNewPaidOrder?: (order: Order) => void;
    onOrderUpdate?: (order: Order) => void;
}

export function useOrderRealtime({ orgId, onNewPaidOrder, onOrderUpdate }: UseOrderRealtimeOptions) {
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    useEffect(() => {
        if (!orgId) return;

        // Create a channel for this organization's orders
        const channel = supabase
            .channel(`orders:${orgId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'orders',
                    filter: `org_id=eq.${orgId}`,
                },
                (payload) => {
                    const newOrder = payload.new as Order;

                    // Trigger callback for new paid orders (notification worthy)
                    if (newOrder.status === 'paid' && onNewPaidOrder) {
                        onNewPaidOrder(newOrder);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `org_id=eq.${orgId}`,
                },
                (payload) => {
                    const updatedOrder = payload.new as Order;

                    if (onOrderUpdate) {
                        onOrderUpdate(updatedOrder);
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
        };
    }, [orgId, onNewPaidOrder, onOrderUpdate]);
}
