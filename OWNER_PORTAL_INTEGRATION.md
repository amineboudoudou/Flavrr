# Owner Portal Integration Guide

This guide explains how to integrate the backend APIs into your Owner Portal frontend.

## Overview

The Owner Portal is a web application (iPad-optimized) where restaurant staff can:
- View incoming orders in real-time
- Accept and manage order status
- Request delivery via Uber Direct
- Track deliveries
- Receive push notifications

## Authentication

### 1. Setup Supabase Client

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### 2. Login Flow

```typescript
async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (error) throw error
  
  // Get user profile to verify org access
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role, full_name')
    .eq('user_id', data.user.id)
    .single()
    
  return { user: data.user, profile }
}
```

### 3. Protected Routes

```typescript
// middleware.ts (Next.js example)
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/orders/:path*']
}
```

## Real-time Order Updates

### 1. Subscribe to Orders Channel

```typescript
import { useEffect, useState } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'

export function useRealtimeOrders(orgId: string) {
  const [orders, setOrders] = useState<Order[]>([])
  
  useEffect(() => {
    // Initial fetch
    fetchOrders()
    
    // Subscribe to changes
    const channel = supabase
      .channel('orders-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `org_id=eq.${orgId}`
        },
        (payload) => {
          console.log('New order!', payload.new)
          playNotificationSound()
          showToast('New order received!')
          setOrders(prev => [payload.new as Order, ...prev])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `org_id=eq.${orgId}`
        },
        (payload) => {
          console.log('Order updated', payload.new)
          setOrders(prev => 
            prev.map(o => o.id === payload.new.id ? payload.new as Order : o)
          )
        }
      )
      .subscribe()
      
    return () => {
      channel.unsubscribe()
    }
  }, [orgId])
  
  return orders
}

function playNotificationSound() {
  const audio = new Audio('/notification.mp3')
  audio.play()
}
```

### 2. Subscribe to Delivery Updates

```typescript
export function useDeliveryTracking(orderId: string) {
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  
  useEffect(() => {
    const channel = supabase
      .channel(`delivery-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          console.log('Delivery update', payload)
          setDelivery(payload.new as Delivery)
          
          if (payload.new.status === 'picked_up') {
            showToast('Driver has picked up the order')
          }
        }
      )
      .subscribe()
      
    return () => channel.unsubscribe()
  }, [orderId])
  
  return delivery
}
```

## Fetching Orders

### 1. List Orders with Filters

```typescript
const FUNCTIONS_URL = process.env.NEXT_PUBLIC_FUNCTIONS_URL

async function fetchOrders(filters: {
  status?: string[]
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}) {
  const { data: { session } } = await supabase.auth.getSession()
  
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status.join(','))
  if (filters.dateFrom) params.set('date_from', filters.dateFrom)
  if (filters.dateTo) params.set('date_to', filters.dateTo)
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.offset) params.set('offset', String(filters.offset))
  
  const response = await fetch(
    `${FUNCTIONS_URL}/owner_list_orders?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${session?.access_token}`
      }
    }
  )
  
  return response.json()
}
```

### 2. Group Orders by Status

```typescript
function useOrdersByStatus() {
  const [orderGroups, setOrderGroups] = useState({
    incoming: [],
    preparing: [],
    ready: [],
    outForDelivery: [],
    completed: []
  })
  
  useEffect(() => {
    async function load() {
      const { orders } = await fetchOrders({ 
        status: ['paid', 'accepted', 'preparing', 'ready', 'out_for_delivery']
      })
      
      setOrderGroups({
        incoming: orders.filter(o => o.status === 'paid'),
        preparing: orders.filter(o => o.status === 'preparing'),
        ready: orders.filter(o => o.status === 'ready'),
        outForDelivery: orders.filter(o => o.status === 'out_for_delivery'),
        completed: orders.filter(o => o.status === 'completed')
      })
    }
    
    load()
  }, [])
  
  return orderGroups
}
```

## Updating Order Status

### 1. Update Status Function

```typescript
async function updateOrderStatus(orderId: string, newStatus: string) {
  const { data: { session } } = await supabase.auth.getSession()
  
  const response = await fetch(`${FUNCTIONS_URL}/owner_update_order_status`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      order_id: orderId,
      new_status: newStatus
    })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error)
  }
  
  return response.json()
}
```

### 2. Status Buttons Component

```typescript
interface OrderActionsProps {
  order: Order
  onUpdate: () => void
}

export function OrderActions({ order, onUpdate }: OrderActionsProps) {
  const [loading, setLoading] = useState(false)
  
  async function handleStatusChange(newStatus: string) {
    setLoading(true)
    try {
      await updateOrderStatus(order.id, newStatus)
      showToast('Order status updated')
      onUpdate()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }
  
  // Show different buttons based on current status
  switch (order.status) {
    case 'paid':
      return (
        <>
          <Button onClick={() => handleStatusChange('accepted')}>
            Accept Order
          </Button>
          <Button variant="outline" onClick={() => handleStatusChange('canceled')}>
            Cancel
          </Button>
        </>
      )
    
    case 'accepted':
      return (
        <Button onClick={() => handleStatusChange('preparing')}>
          Start Preparing
        </Button>
      )
    
    case 'preparing':
      return (
        <Button onClick={() => handleStatusChange('ready')}>
          Mark as Ready
        </Button>
      )
    
    case 'ready':
      return order.fulfillment_type === 'delivery' ? (
        <Button onClick={() => handleDelivery()}>
          Request Delivery
        </Button>
      ) : (
        <Button onClick={() => handleStatusChange('completed')}>
          Mark as Completed
        </Button>
      )
    
    default:
      return null
  }
}
```

## Uber Direct Integration

### 1. Request Quote

```typescript
async function requestDeliveryQuote(orderId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  
  const response = await fetch(`${FUNCTIONS_URL}/uber_quote`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ order_id: orderId })
  })
  
  return response.json()
}
```

### 2. Create Delivery

```typescript
async function createDelivery(orderId: string, quoteId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  
  const response = await fetch(`${FUNCTIONS_URL}/uber_create_delivery`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ order_id: orderId, quote_id: quoteId })
  })
  
  return response.json()
}
```

### 3. Delivery Flow Component

```typescript
export function DeliveryPanel({ order }: { order: Order }) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [loading, setLoading] = useState(false)
  
  async function handleRequestQuote() {
    setLoading(true)
    try {
      const result = await requestDeliveryQuote(order.id)
      setQuote(result.quote)
    } catch (error) {
      showToast('Failed to get delivery quote', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  async function handleCreateDelivery() {
    if (!quote) return
    
    setLoading(true)
    try {
      const result = await createDelivery(order.id, quote.id)
      setDelivery(result.delivery)
      showToast('Delivery requested!')
    } catch (error) {
      showToast('Failed to create delivery', 'error')
    } finally {
      setLoading(false)
    }
  }
  
  if (delivery) {
    return (
      <div className="delivery-status">
        <h3>Delivery Status: {delivery.status}</h3>
        <p>ETA: {delivery.dropoff_eta}</p>
        <a href={delivery.tracking_url} target="_blank">
          Track Delivery
        </a>
      </div>
    )
  }
  
  if (quote) {
    return (
      <div className="delivery-quote">
        <p>Delivery Fee: ${quote.fee_cents / 100}</p>
        <p>ETA: {quote.eta_minutes} minutes</p>
        <Button onClick={handleCreateDelivery} loading={loading}>
          Confirm Delivery
        </Button>
      </div>
    )
  }
  
  return (
    <Button onClick={handleRequestQuote} loading={loading}>
      Get Delivery Quote
    </Button>
  )
}
```

## Push Notifications

### 1. Request Permission

```typescript
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications')
    return false
  }
  
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}
```

### 2. Show Notification

```typescript
function showPushNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/logo.png',
      badge: '/badge.png',
      vibrate: [200, 100, 200],
      ...options
    })
  }
}

// Use in realtime subscription
function onNewOrder(order: Order) {
  showPushNotification('New Order!', {
    body: `Order #${order.public_token} - $${order.total_cents / 100}`,
    tag: order.id,
    requireInteraction: true
  })
  
  playNotificationSound()
}
```

## Kitchen Screen View

For a simplified kitchen display:

```typescript
export function KitchenScreen() {
  const orders = useRealtimeOrders(orgId)
  const activeOrders = orders.filter(o => 
    ['accepted', 'preparing'].includes(o.status)
  )
  
  return (
    <div className="kitchen-grid">
      {activeOrders.map(order => (
        <div key={order.id} className="kitchen-card">
          <div className="order-number">#{order.public_token}</div>
          <div className="elapsed-time">
            {getElapsedTime(order.created_at)}
          </div>
          <div className="items-list">
            {order.items.map(item => (
              <div key={item.id}>
                <span className="quantity">{item.quantity}x</span>
                <span className="name">{item.name_snapshot}</span>
                {item.notes && <div className="notes">{item.notes}</div>}
              </div>
            ))}
          </div>
          <Button onClick={() => updateOrderStatus(order.id, 'ready')}>
            Mark Ready
          </Button>
        </div>
      ))}
    </div>
  )
}
```

## UI/UX Recommendations

### For iPad Optimization

1. **Large Touch Targets**: Buttons should be at least 44x44px
2. **High Contrast**: Easy to read from distance
3. **Auto-refresh**: Keep realtime connection alive
4. **Offline Handling**: Queue status updates if connection drops
5. **Sound Alerts**: Clear audio for new orders
6. **Badge Count**: Show pending order count

### Suggested Layout

```
┌─────────────────────────────────────┐
│  Header: Café Du Griot | Logout    │
├─────────────────────────────────────┤
│  Incoming (3)  │ Preparing (2)  │...│
├─────────────────────────────────────┤
│  ┌─────────┐   ┌─────────┐         │
│  │ Order 1 │   │ Order 4 │         │
│  │ #ABC123 │   │ #DEF456 │         │
│  │ 2 items │   │ 3 items │         │
│  │ $35.00  │   │ $42.00  │         │
│  │[Accept] │   │ [Ready] │         │
│  └─────────┘   └─────────┘         │
│                                     │
│  ┌─────────┐                        │
│  │ Order 2 │                        │
│  │ #GHI789 │                        │
│  └─────────┘                        │
└─────────────────────────────────────┘
```

## Error Handling

```typescript
function handleApiError(error: any) {
  if (error.status === 401) {
    // Token expired, re-authenticate
    router.push('/login')
  } else if (error.status === 403) {
    showToast('You do not have permission for this action', 'error')
  } else if (error.status === 400) {
    showToast(error.error || 'Invalid request', 'error')
  } else {
    showToast('Something went wrong. Please try again.', 'error')
  }
}
```

## Testing Realtime

```typescript
// Simulate new order in development
async function simulateNewOrder() {
  await supabase.from('orders').insert({
    org_id: 'your-org-id',
    status: 'paid',
    fulfillment_type: 'pickup',
    customer_name: 'Test Customer',
    total_cents: 3500,
    // ... other fields
  })
}
```
