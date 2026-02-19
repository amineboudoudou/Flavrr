import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface TrackingOrder {
  order_number: number;
  status: string;
  fulfillment_type: string;
  created_at: string;
  ready_at?: string;
  completed_at?: string;
  uber_tracking_url?: string;
  uber_status?: string;
  items: any[];
  total_cents: number;
  customer_name: string;
}

export const PublicTracking: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, order_number, status, fulfillment_type, created_at, ready_at, completed_at, uber_tracking_url, uber_status, total_cents, customer_name')
          .eq('public_token', token)
          .single();

        if (error) throw error;

        // Fetch order items
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('name_snapshot, price_cents_snapshot, quantity')
          .eq('order_id', data.id);

        if (itemsError) throw itemsError;

        setOrder({ ...data, items: items || [] });
      } catch (err: any) {
        setError(err.message || 'Order not found');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();

    // Subscribe to realtime updates
    const subscription = supabase
      .channel(`public:orders:public_token=eq.${token}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `public_token=eq.${token}`
      }, (payload) => {
        setOrder(prev => prev ? { ...prev, ...payload.new } : null);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm opacity-60">Loading order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Order not found'}</p>
          <p className="text-white/60 text-sm">Please check your tracking link</p>
        </div>
      </div>
    );
  }

  const getStatusMessage = () => {
    switch (order.status) {
      case 'paid':
      case 'accepted':
        return { title: 'Order Received', subtitle: 'We\'ve received your order and will start preparing soon.', icon: '📋', color: 'blue' };
      case 'preparing':
        return { title: 'Preparing Your Order', subtitle: 'Our kitchen is working on your delicious meal!', icon: '👨‍🍳', color: 'orange' };
      case 'ready':
        return order.fulfillment_type === 'pickup' 
          ? { title: 'Ready for Pickup!', subtitle: 'Your order is ready! Come pick it up now.', icon: '✅', color: 'green' }
          : { title: 'Ready for Delivery', subtitle: 'Your order is ready and will be delivered soon.', icon: '📦', color: 'purple' };
      case 'out_for_delivery':
        return { title: 'Out for Delivery', subtitle: 'Your order is on its way to you!', icon: '🚚', color: 'purple' };
      case 'completed':
        return { title: 'Order Completed', subtitle: 'Enjoy your meal! Thank you for ordering.', icon: '🎉', color: 'green' };
      default:
        return { title: 'Processing', subtitle: 'We\'re working on your order...', icon: '⏳', color: 'gray' };
    }
  };

  const statusMessage = getStatusMessage();

  const statusSteps = [
    { key: 'incoming', label: 'Order Received', completed: true },
    { key: 'preparing', label: 'Preparing', completed: ['preparing', 'ready', 'out_for_delivery', 'completed'].includes(order.status) },
    { key: 'ready', label: 'Ready', completed: ['ready', 'out_for_delivery', 'completed'].includes(order.status) },
    ...(order.fulfillment_type === 'delivery' ? [
      { key: 'out_for_delivery', label: 'Out for Delivery', completed: ['out_for_delivery', 'completed'].includes(order.status) }
    ] : []),
    { key: 'completed', label: order.fulfillment_type === 'delivery' ? 'Delivered' : 'Completed', completed: order.status === 'completed' }
  ];

  return (
    <div className="min-h-screen bg-neutral-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-neutral-800 border border-white/10 rounded-xl p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-white text-3xl font-bold mb-2">
              Order #{order.order_number.toString().padStart(4, '0')}
            </h1>
            <p className="text-white/60 text-sm">
              Placed {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
            </p>
            <p className="text-white/80 mt-2">Hello {order.customer_name}!</p>
          </div>

          {/* Status Message */}
          <div className={`mb-8 p-6 rounded-xl bg-${statusMessage.color}-500/10 border border-${statusMessage.color}-500/30`}>
            <div className="flex items-center gap-4">
              <span className="text-4xl">{statusMessage.icon}</span>
              <div>
                <h2 className={`text-${statusMessage.color}-400 text-xl font-bold`}>{statusMessage.title}</h2>
                <p className="text-white/70 text-sm mt-1">{statusMessage.subtitle}</p>
              </div>
            </div>
          </div>

          {/* ETA for Pickup */}
          {order.fulfillment_type === 'pickup' && order.status === 'preparing' && (
            <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <p className="text-blue-400 text-sm font-semibold">⏱️ Estimated Ready Time</p>
              <p className="text-white text-lg font-bold mt-1">15-25 minutes</p>
              <p className="text-white/60 text-xs mt-1">We'll notify you when your order is ready!</p>
            </div>
          )}

          {/* Status Timeline */}
          <div className="space-y-4 mb-8">
            {statusSteps.map((step, index) => (
              <div key={step.key} className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.completed ? 'bg-green-500' : 'bg-neutral-700'
                }`}>
                  {step.completed ? (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-white/40">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${step.completed ? 'text-white' : 'text-white/40'}`}>
                    {step.label}
                  </p>
                  {step.completed && step.key === order.status && (
                    <p className="text-green-400 text-sm">Current status</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tracking Link */}
          {order.uber_tracking_url && (
            <a
              href={order.uber_tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-purple-600 hover:bg-purple-700 text-white text-center font-semibold py-3 rounded-lg transition-colors mb-8"
            >
              📍 Track Delivery Live
            </a>
          )}

          {/* Order Items */}
          <div className="pt-8 border-t border-white/10">
            <h3 className="text-white font-semibold mb-4">Order Items</h3>
            <div className="space-y-2">
              {order.items.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-white/80">
                  <span>{item.quantity}x {item.name_snapshot}</span>
                  <span>${((item.price_cents_snapshot || 0) * (item.quantity || 0) / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-white font-bold text-lg">
              <span>Total</span>
              <span>${((order.total_cents || 0) / 100).toFixed(2)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-8 border-t border-white/10 text-center">
            <p className="text-white/40 text-sm">
              Thank you for your order!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
