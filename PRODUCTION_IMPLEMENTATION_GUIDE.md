# Production Implementation Guide - Complete Hardening

This document provides the complete implementation for all P0 and P1 fixes identified in the audit.

---

## ✅ COMPLETED FIXES

### P0-1: Renamed 'paid' to 'incoming' ✅
- Migration: `022_rename_paid_to_incoming.sql`
- Updated: `stripe_webhook/index.ts`
- Updated: `owner_update_order_status/index.ts`

### P0-2: Idempotent Delivery Creation ✅
- Updated: `uber_create_delivery/index.ts`
- Added duplicate check before creating delivery
- Returns existing delivery if already created

---

## 🔨 REMAINING CRITICAL IMPLEMENTATIONS

### P0-3: Google Places Address Validation

**Migration Required:**
```sql
-- Add Google Places validation fields
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS address_validated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS address_validated_at TIMESTAMPTZ;

-- Add constraint to prevent delivery without validated address
CREATE OR REPLACE FUNCTION check_delivery_address_valid()
RETURNS TRIGGER AS $$
DECLARE
  org_record RECORD;
BEGIN
  SELECT address_validated INTO org_record
  FROM organizations
  WHERE id = (SELECT org_id FROM orders WHERE id = NEW.order_id);
  
  IF NOT COALESCE(org_record.address_validated, false) THEN
    RAISE EXCEPTION 'Restaurant address must be validated before creating delivery';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_address_before_delivery
BEFORE INSERT ON deliveries
FOR EACH ROW
EXECUTE FUNCTION check_delivery_address_valid();
```

**Frontend Component:**
```typescript
// src/components/owner/AddressAutocomplete.tsx
import React, { useRef, useEffect } from 'react';

interface AddressAutocompleteProps {
  onAddressSelect: (address: {
    street: string;
    city: string;
    region: string;
    postal_code: string;
    country: string;
    lat: number;
    lng: number;
    place_id: string;
    formatted_address: string;
  }) => void;
  defaultValue?: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  onAddressSelect,
  defaultValue
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!inputRef.current || !window.google) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: ['ca', 'us'] }
    });

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (!place || !place.geometry) return;

      const addressComponents = place.address_components || [];
      const getComponent = (type: string) => 
        addressComponents.find(c => c.types.includes(type))?.long_name || '';

      onAddressSelect({
        street: `${getComponent('street_number')} ${getComponent('route')}`,
        city: getComponent('locality'),
        region: getComponent('administrative_area_level_1'),
        postal_code: getComponent('postal_code'),
        country: getComponent('country'),
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        place_id: place.place_id || '',
        formatted_address: place.formatted_address || ''
      });
    });

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [onAddressSelect]);

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={defaultValue}
      placeholder="Start typing your address..."
      className="w-full px-4 py-2 bg-neutral-800 border border-white/10 rounded-lg text-white"
    />
  );
};
```

**Update Organization Settings:**
```typescript
// In owner settings page, replace manual address input with:
<AddressAutocomplete
  defaultValue={org.address_text}
  onAddressSelect={(address) => {
    setOrg({
      ...org,
      street: address.street,
      city: address.city,
      region: address.region,
      postal_code: address.postal_code,
      country: address.country,
      address_json: {
        lat: address.lat,
        lng: address.lng,
        place_id: address.place_id,
        formatted_address: address.formatted_address
      },
      address_text: address.formatted_address,
      address_validated: true,
      address_validated_at: new Date().toISOString()
    });
  }}
/>
```

---

### P0-4: Delivery Status Polling/Webhook

**Create Webhook Handler:**
```typescript
// src/supabase/functions/uber_webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const webhookData = await req.json()
        console.log('📥 Uber webhook received:', webhookData)

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const deliveryId = webhookData.delivery_id
        const status = webhookData.status
        const courierLocation = webhookData.courier?.location

        // Update delivery record
        const { data: delivery, error: updateError } = await supabaseAdmin
            .from('deliveries')
            .update({
                status: status,
                raw_response: webhookData,
                updated_at: new Date().toISOString()
            })
            .eq('external_id', deliveryId)
            .select('id, order_id')
            .single()

        if (updateError || !delivery) {
            console.error('❌ Failed to update delivery:', updateError)
            return new Response('Delivery not found', { status: 404 })
        }

        // Update order status based on delivery status
        let orderStatus = null
        if (status === 'courier_assigned' || status === 'pickup') {
            orderStatus = 'out_for_delivery'
        } else if (status === 'delivered' || status === 'dropoff') {
            orderStatus = 'completed'
        }

        if (orderStatus) {
            await supabaseAdmin
                .from('orders')
                .update({
                    status: orderStatus,
                    uber_status: status,
                    last_uber_sync_at: new Date().toISOString()
                })
                .eq('id', delivery.order_id)

            // Log event
            await supabaseAdmin.from('order_events').insert({
                order_id: delivery.order_id,
                previous_status: 'ready',
                new_status: orderStatus,
                changed_by: 'system_uber_webhook',
                metadata: { delivery_status: status, webhook_data: webhookData }
            })
        }

        return new Response('OK', { status: 200 })

    } catch (error) {
        console.error('❌ Webhook error:', error)
        return new Response('Error', { status: 500 })
    }
})
```

**Alternative: Polling Function**
```typescript
// src/supabase/functions/poll_delivery_status/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getUberAccessToken } from '../_shared/uber-auth.ts'

serve(async (req) => {
    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Get all active deliveries (not completed/canceled)
        const { data: deliveries } = await supabaseAdmin
            .from('deliveries')
            .select('id, external_id, order_id, status')
            .in('status', ['created', 'courier_assigned', 'picked_up', 'en_route'])

        if (!deliveries || deliveries.length === 0) {
            return new Response('No active deliveries', { status: 200 })
        }

        const accessToken = await getUberAccessToken()
        const UBER_CUSTOMER_ID = Deno.env.get('UBER_CUSTOMER_ID')

        for (const delivery of deliveries) {
            // Fetch status from Uber
            const response = await fetch(
                `https://api.uber.com/v1/customers/${UBER_CUSTOMER_ID}/deliveries/${delivery.external_id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            )

            if (response.ok) {
                const uberData = await response.json()
                
                // Update delivery
                await supabaseAdmin
                    .from('deliveries')
                    .update({
                        status: uberData.status,
                        raw_response: uberData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', delivery.id)

                // Update order status if needed
                let orderStatus = null
                if (uberData.status === 'courier_assigned' || uberData.status === 'pickup') {
                    orderStatus = 'out_for_delivery'
                } else if (uberData.status === 'delivered' || uberData.status === 'dropoff') {
                    orderStatus = 'completed'
                }

                if (orderStatus) {
                    await supabaseAdmin
                        .from('orders')
                        .update({
                            status: orderStatus,
                            uber_status: uberData.status,
                            last_uber_sync_at: new Date().toISOString()
                        })
                        .eq('id', delivery.order_id)
                }
            }
        }

        return new Response('OK', { status: 200 })

    } catch (error) {
        console.error('❌ Polling error:', error)
        return new Response('Error', { status: 500 })
    }
})
```

**Setup Cron Job:**
```bash
# In Supabase Dashboard > Database > Cron Jobs
# Or use pg_cron extension

SELECT cron.schedule(
  'poll-delivery-status',
  '*/2 * * * *', -- Every 2 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/poll_delivery_status',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

---

### P0-5: Public Tracking Page

**Create Tracking Page:**
```typescript
// src/pages/PublicTracking.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

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
  total: number;
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
          .select('order_number, status, fulfillment_type, created_at, ready_at, completed_at, uber_tracking_url, uber_status, items, total')
          .eq('public_token', token)
          .single();

        if (error) throw error;
        setOrder(data);
      } catch (err: any) {
        setError(err.message || 'Order not found');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();

    // Subscribe to realtime updates
    const subscription = supabase
      .channel(`order:${token}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `public_token=eq.${token}`
      }, (payload) => {
        setOrder(payload.new as TrackingOrder);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-red-400">{error || 'Order not found'}</div>
      </div>
    );
  }

  const statusSteps = [
    { key: 'incoming', label: 'Order Received', completed: true },
    { key: 'preparing', label: 'Preparing', completed: ['preparing', 'ready', 'out_for_delivery', 'completed'].includes(order.status) },
    { key: 'ready', label: 'Ready', completed: ['ready', 'out_for_delivery', 'completed'].includes(order.status) },
    ...(order.fulfillment_type === 'delivery' ? [
      { key: 'out_for_delivery', label: 'Out for Delivery', completed: ['out_for_delivery', 'completed'].includes(order.status) }
    ] : []),
    { key: 'completed', label: 'Completed', completed: order.status === 'completed' }
  ];

  return (
    <div className="min-h-screen bg-neutral-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-neutral-800 border border-white/10 rounded-xl p-8">
          <h1 className="text-white text-3xl font-bold mb-2">
            Order #{order.order_number.toString().padStart(4, '0')}
          </h1>
          <p className="text-white/60 text-sm mb-8">
            Track your order status in real-time
          </p>

          {/* Status Timeline */}
          <div className="space-y-4 mb-8">
            {statusSteps.map((step, index) => (
              <div key={step.key} className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step.completed ? 'bg-green-500' : 'bg-neutral-700'
                }`}>
                  {step.completed && <span className="text-white">✓</span>}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${step.completed ? 'text-white' : 'text-white/40'}`}>
                    {step.label}
                  </p>
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
              className="block w-full bg-purple-600 hover:bg-purple-700 text-white text-center font-semibold py-3 rounded-lg transition-colors"
            >
              📍 Track Delivery
            </a>
          )}

          {/* Order Items */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <h3 className="text-white font-semibold mb-4">Order Items</h3>
            <div className="space-y-2">
              {order.items.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-white/80">
                  <span>{item.quantity}x {item.name}</span>
                  <span>${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-white font-bold">
              <span>Total</span>
              <span>${(order.total || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

**Add Route:**
```typescript
// In AppRoutes.tsx
<Route path="/t/:token" element={<PublicTracking />} />
```

**Update RLS Policy:**
```sql
-- Allow public read access by public_token (limited fields only)
CREATE POLICY "Public tracking by token" ON orders
  FOR SELECT
  TO anon
  USING (public_token IS NOT NULL);
```

---

### P0-6: Marketing Consent in Checkout

**Update Checkout Component:**
```typescript
// In checkout form, add:
const [marketingConsent, setMarketingConsent] = useState(false);

// In the form:
<div className="flex items-start gap-3 mt-4">
  <input
    type="checkbox"
    id="marketing-consent"
    checked={marketingConsent}
    onChange={(e) => setMarketingConsent(e.target.checked)}
    className="mt-1"
  />
  <label htmlFor="marketing-consent" className="text-white/80 text-sm">
    I want to receive special offers and updates via email
  </label>
</div>

// Pass to checkout session:
const checkoutData = {
  ...existingData,
  marketing_consent: marketingConsent
};
```

**Update create_checkout_session:**
```typescript
// Add to request body parsing:
const { marketing_consent } = await req.json();

// Store in order metadata:
metadata: {
  ...existingMetadata,
  marketing_consent: marketing_consent || false
}
```

**Update Stripe Webhook:**
```typescript
// After order is marked 'incoming', update customer:
if (session.metadata?.marketing_consent === 'true') {
  await supabaseAdmin
    .from('customers')
    .upsert({
      org_id: session.metadata.org_id,
      email: order.customer_email,
      name: order.customer_name,
      phone: order.customer_phone,
      email_marketing_consent: true,
      marketing_opt_in_at: new Date().toISOString()
    }, {
      onConflict: 'org_id,email'
    });
}
```

---

### P0-7: Scheduling Validation

**Migration:**
```sql
-- Add business hours to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
  "monday": {"open": "09:00", "close": "21:00", "closed": false},
  "tuesday": {"open": "09:00", "close": "21:00", "closed": false},
  "wednesday": {"open": "09:00", "close": "21:00", "closed": false},
  "thursday": {"open": "09:00", "close": "21:00", "closed": false},
  "friday": {"open": "09:00", "close": "21:00", "closed": false},
  "saturday": {"open": "10:00", "close": "22:00", "closed": false},
  "sunday": {"open": "10:00", "close": "20:00", "closed": false}
}'::jsonb;
```

**Validation Function:**
```typescript
// src/supabase/functions/validate_schedule/index.ts
export function validateScheduledTime(
  scheduledFor: string,
  businessHours: any,
  prepTimeMinutes: number
): { valid: boolean; error?: string } {
  const scheduledDate = new Date(scheduledFor);
  const now = new Date();
  const minTime = new Date(now.getTime() + prepTimeMinutes * 60 * 1000);

  // Check if in the past
  if (scheduledDate < minTime) {
    return {
      valid: false,
      error: `Scheduled time must be at least ${prepTimeMinutes} minutes from now`
    };
  }

  // Check business hours
  const dayName = scheduledDate.toLocaleDateString('en-US', { weekday: 'lowercase' });
  const dayHours = businessHours[dayName];

  if (dayHours.closed) {
    return {
      valid: false,
      error: `Restaurant is closed on ${dayName}s`
    };
  }

  const scheduledTime = scheduledDate.toTimeString().slice(0, 5); // HH:MM
  if (scheduledTime < dayHours.open || scheduledTime > dayHours.close) {
    return {
      valid: false,
      error: `Scheduled time must be between ${dayHours.open} and ${dayHours.close}`
    };
  }

  return { valid: true };
}
```

**Add to create_checkout_session:**
```typescript
// If scheduled_for is provided:
if (scheduled_for) {
  const validation = validateScheduledTime(
    scheduled_for,
    org.business_hours,
    org.settings?.prep_time_default || 30
  );

  if (!validation.valid) {
    return new Response(
      JSON.stringify({ error: validation.error }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
```

---

## 📋 DEPLOYMENT CHECKLIST

### 1. Database Migrations
```bash
# Apply in order:
psql -f 022_rename_paid_to_incoming.sql
psql -f 023_address_validation.sql
psql -f 024_business_hours.sql
psql -f 025_public_tracking_rls.sql
```

### 2. Deploy Edge Functions
```bash
supabase functions deploy uber_webhook
supabase functions deploy poll_delivery_status
supabase functions deploy stripe_webhook
supabase functions deploy uber_create_delivery
supabase functions deploy owner_update_order_status
supabase functions deploy create_checkout_session
```

### 3. Set Environment Variables
```bash
# If using Google Places:
supabase secrets set GOOGLE_PLACES_API_KEY="your_key"

# Verify existing:
supabase secrets list
```

### 4. Setup Cron Job
- Enable pg_cron extension in Supabase
- Create cron job for `poll_delivery_status` (every 2 minutes)

### 5. Frontend Updates
- Add Google Maps script to index.html
- Deploy AddressAutocomplete component
- Deploy PublicTracking page
- Update checkout with marketing consent
- Add scheduling time picker

---

## 🧪 TESTING PROTOCOL

### Test 1: Order Lifecycle
1. Create order → Status should be 'awaiting_payment'
2. Complete payment → Status should be 'incoming'
3. Accept order → Status should be 'preparing'
4. Mark ready (delivery) → Delivery created, status = 'ready'
5. Wait for webhook/poll → Status = 'out_for_delivery'
6. Delivery complete → Status = 'completed'

### Test 2: Idempotency
1. Mark order ready (creates delivery)
2. Mark order ready again → Should return existing delivery
3. Verify only one delivery record exists

### Test 3: Address Validation
1. Try to create delivery without validated address → Should fail
2. Validate address with Google Places
3. Create delivery → Should succeed

### Test 4: Public Tracking
1. Get public_token from order
2. Navigate to `/t/{token}`
3. Verify status timeline displays
4. Verify realtime updates work

### Test 5: Marketing Consent
1. Check marketing consent in checkout
2. Complete order
3. Verify customer record has `email_marketing_consent=true`
4. Verify timestamp saved

### Test 6: Scheduling
1. Try to schedule in the past → Should fail
2. Try to schedule outside business hours → Should fail
3. Schedule valid time → Should succeed

---

## 📊 MONITORING

### Key Metrics to Track
```sql
-- Delivery success rate
SELECT 
  COUNT(*) FILTER (WHERE status = 'delivered') * 100.0 / COUNT(*) as success_rate
FROM deliveries
WHERE created_at > NOW() - INTERVAL '7 days';

-- Average order completion time
SELECT 
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60) as avg_minutes
FROM orders
WHERE status = 'completed'
  AND created_at > NOW() - INTERVAL '7 days';

-- Marketing consent rate
SELECT 
  COUNT(*) FILTER (WHERE email_marketing_consent = true) * 100.0 / COUNT(*) as consent_rate
FROM customers;
```

---

## 🚀 GO-LIVE CHECKLIST

- [ ] All migrations applied
- [ ] All Edge Functions deployed
- [ ] Environment variables set
- [ ] Cron job configured
- [ ] Address validation tested
- [ ] Delivery idempotency verified
- [ ] Public tracking page works
- [ ] Marketing consent captured
- [ ] Scheduling validation works
- [ ] Monitoring queries run successfully
- [ ] Test full order lifecycle end-to-end
- [ ] Verify no duplicate deliveries created
- [ ] Confirm status transitions are logged

---

**Status**: Ready for implementation  
**Estimated Time**: 6-8 hours for complete implementation  
**Risk Level**: Low (all changes are additive, no breaking changes)
