# Production Deployment Checklist

Complete checklist before deploying to production.

## Pre-Launch Requirements

### 1. Supabase Configuration

- [ ] **Project Created**: Production Supabase project created
- [ ] **Database Migrations**: All migrations applied successfully
  ```bash
  supabase db push
  ```
- [ ] **Seed Data**: Production organization(s) seeded
- [ ] **RLS Policies**: All policies enabled and tested
  ```sql
  -- Verify RLS is enabled on all tables
  SELECT tablename, rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public' 
  AND rowsecurity = false;
  -- Should return no rows
  ```
- [ ] **Realtime**: Orders, deliveries, notifications tables enabled
- [ ] **Backups**: Automated backups configured (Settings → Database → Backups)
- [ ] **Custom Domain**: Optional custom domain configured (e.g., db.cafedugriot.com)

### 2. Environment Variables

- [ ] **All Secrets Set**: Run environment check
  ```bash
  supabase secrets list
  ```
  
  Required secrets:
  - `STRIPE_SECRET_KEY` (live key, starts with `sk_live_`)
  - `STRIPE_WEBHOOK_SECRET` (production webhook secret)
  - `UBER_DIRECT_CLIENT_ID` (production)
  - `UBER_DIRECT_CLIENT_SECRET` (production)
  - `UBER_DIRECT_CUSTOMER_ID` (production)
  - `APP_BASE_URL` (production domain)
  - `RESEND_API_KEY` (production key)

- [ ] **Frontend Env Vars**: Update frontend `.env.production`
  ```bash
  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  NEXT_PUBLIC_FUNCTIONS_URL=https://xxx.supabase.co/functions/v1
  ```

### 3. Stripe Setup

- [ ] **Live Mode Enabled**: Switched from test to live mode
- [ ] **Live Keys**: Using live secret key (starts with `sk_live_`)
- [ ] **Webhook Configured**: Production webhook endpoint registered
  - URL: `https://your-project.supabase.co/functions/v1/stripe_webhook`
  - Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
  - Secret saved in environment variables
- [ ] **Test Payment**: Complete a test live payment (use low amount, then refund)
- [ ] **Currency**: Verify currency is CAD
- [ ] **Tax Rates**: Tax rates configured in organization settings

### 4. Uber Direct Setup

- [ ] **Production Account**: Switched to production credentials
- [ ] **Live Credentials**: Production client ID, secret, and customer ID
- [ ] **Webhook Configured**: If supported, webhook URL registered
  - URL: `https://your-project.supabase.co/functions/v1/uber_webhook`
- [ ] **Test Delivery**: Create test delivery in production
- [ ] **Pickup Address**: Verify organization pickup address is correct
- [ ] **Delivery Zones**: Verify delivery zones in org settings

### 5. Edge Functions

- [ ] **All Functions Deployed**: Deploy all 9 functions
  ```bash
  supabase functions deploy public_get_menu
  supabase functions deploy create_checkout_session
  supabase functions deploy stripe_webhook --no-verify-jwt
  supabase functions deploy get_order_by_token
  supabase functions deploy owner_list_orders
  supabase functions deploy owner_update_order_status
  supabase functions deploy uber_quote
  supabase functions deploy uber_create_delivery
  supabase functions deploy uber_webhook --no-verify-jwt
  ```

- [ ] **Function Logs**: Test each function and check logs
  ```bash
  supabase functions logs <function-name> --tail
  ```

- [ ] **CORS Configuration**: Verify CORS headers match your domain
- [ ] **Rate Limiting**: Consider implementing rate limiting for public endpoints

### 6. Authentication & Users

- [ ] **Owner Account Created**: Create production owner user via Supabase Dashboard
- [ ] **Profile Created**: Link user to organization in `profiles` table
- [ ] **Test Login**: Verify owner can log in to portal
- [ ] **Password Policy**: Review and set password requirements
- [ ] **MFA**: Consider enabling multi-factor authentication

### 7. Security Review

- [ ] **RLS Tested**: Verify users cannot access other orgs' data
  ```sql
  -- Test with regular user token
  SET request.jwt.claims.sub = '<user-uuid>';
  SELECT * FROM orders WHERE org_id != '<users-org-id>';
  -- Should return 0 rows
  ```

- [ ] **Service Role Protected**: Ensure service role key is never exposed to frontend
- [ ] **API Keys Rotated**: If any keys were committed to git, rotate them
- [ ] **SSL Enabled**: HTTPS enforced on all endpoints
- [ ] **Input Validation**: All Edge Functions validate input
- [ ] **SQL Injection**: No raw SQL with user input
- [ ] **XSS Protection**: Sanitize user input in frontend

### 8. Performance Optimization

- [ ] **Database Indexes**: Verify all indexes created (migration 009)
  ```sql
  SELECT indexname, indexdef FROM pg_indexes 
  WHERE schemaname = 'public' 
  ORDER BY tablename, indexname;
  ```

- [ ] **Query Performance**: Test slow query log
  ```sql
  -- Enable slow query logging
  ALTER SYSTEM SET log_min_duration_statement = 1000; -- 1 second
  ```

- [ ] **Connection Pooling**: Verify connection pool settings
- [ ] **Caching**: Public menu API returns cache headers
- [ ] **CDN**: Consider CloudFare or similar for static assets

### 9. Monitoring & Logging

- [ ] **Error Tracking**: Set up Sentry or similar
  ```typescript
  // Add to Edge Functions
  import * as Sentry from '@sentry/deno'
  
  Sentry.init({
    dsn: Deno.env.get('SENTRY_DSN'),
    environment: 'production'
  })
  ```

- [ ] **Log Aggregation**: Configure log forwarding (LogDNA, Datadog, etc.)
- [ ] **Uptime Monitoring**: Set up ping checks (UptimeRobot, Pingdom)
- [ ] **Database Metrics**: Monitor connection count, query performance
- [ ] **Alert Setup**: Configure alerts for:
  - Failed payments
  - Edge Function errors
  - Database connection issues
  - Order backlog

### 10. Email & Notifications

- [ ] **Resend API Key**: Production key configured
- [ ] **Email Templates**: Create transactional email templates
  - Order confirmation
  - Order ready
  - Payment receipt
- [ ] **Sender Domain**: Configure custom sending domain (e.g., noreply@cafedugriot.com)
- [ ] **SPF/DKIM**: Set up email authentication
- [ ] **Test Emails**: Send test emails for all templates
- [ ] **Push Notifications**: Web Push configured for owner portal

### 11. Data & Privacy

- [ ] **Privacy Policy**: Updated to mention data collection
- [ ] **Terms of Service**: Legal terms in place
- [ ] **GDPR Compliance**: If serving EU customers
  - Data export capability
  - Data deletion on request
- [ ] **PCI Compliance**: Stripe handles card data (verify integration)
- [ ] **Data Retention**: Policy for old orders (archive after X months?)

### 12. Testing

- [ ] **End-to-End Test**: Complete full order flow
  1. Customer browses menu
  2. Adds items to cart
  3. Completes checkout (real payment, then refund)
  4. Owner receives notification
  5. Owner accepts order
  6. Order progresses through statuses
  7. Delivery requested (if applicable)
  8. Order completed

- [ ] **Load Testing**: Simulate multiple concurrent orders
  ```bash
  # Use Artillery or k6
  artillery quick --count 100 --num 10 https://your-api.com/public_get_menu?org_slug=cafe-du-griot
  ```

- [ ] **Failed Payment**: Test declined card
- [ ] **Refund Flow**: Test admin refund
- [ ] **Invalid Transitions**: Verify state machine enforcement
- [ ] **Expired Quote**: Test Uber quote expiration
- [ ] **Network Failures**: Test offline resilience

### 13. Frontend Deployment

- [ ] **Build Succeeds**: Production build completes without errors
  ```bash
  npm run build
  ```

- [ ] **Environment Variables**: All production env vars set
- [ ] **Static Assets**: Optimized images, fonts
- [ ] **Bundle Size**: Analyzed and optimized
- [ ] **Vercel/Netlify**: Deployed to production hosting
- [ ] **Custom Domain**: DNS configured (cafedugriot.com)
- [ ] **SSL Certificate**: Auto-renewed via Let's Encrypt

### 14. Documentation

- [ ] **Internal Runbook**: Operations guide for staff
- [ ] **API Docs**: Up to date (API.md)
- [ ] **Troubleshooting Guide**: Common issues and fixes
- [ ] **Integration Docs**: Owner portal integration (OWNER_PORTAL_INTEGRATION.md)

### 15. Launch Day

- [ ] **Backup Current Data**: Before final migration
- [ ] **Announce Maintenance**: If migrating from old system
- [ ] **Monitor Closely**: Watch logs, errors, transactions
- [ ] **Support Ready**: Team available for issues
- [ ] **Rollback Plan**: Documented procedure to revert if needed

## Post-Launch Monitoring (First 48 Hours)

### Hour 1
- [ ] First order placed successfully
- [ ] Payment processed
- [ ] Owner portal notification received
- [ ] Email confirmation sent

### Hour 24
- [ ] Review all error logs
- [ ] Check conversion rate (checkout abandonment)
- [ ] Verify all orders completed successfully
- [ ] Monitor database performance

### Hour 48
- [ ] Review Stripe dashboard (failed payments, disputes)
- [ ] Check Uber Direct delivery success rate
- [ ] Analyze user feedback
- [ ] Plan optimizations based on real data

## Regular Maintenance

### Daily
- Review error logs for Edge Functions
- Check failed payments in Stripe
- Monitor order completion rate

### Weekly
- Database backup verification
- Review slow query log
- Check API response times
- Update dependencies if needed

### Monthly
- Review and rotate API keys
- Audit user access permissions
- Database vacuum and analyze
- Cost optimization review

## Emergency Contacts

- **Supabase Support**: support@supabase.io
- **Stripe Support**: https://support.stripe.com
- **Uber Direct Support**: [Your account manager]
- **On-call Developer**: [Phone/Email]

## Rollback Procedure

If critical issues arise:

1. **Revert Edge Functions**:
   ```bash
   supabase functions deploy <function-name> --legacy-bundle
   ```

2. **Database Rollback**:
   ```bash
   supabase db reset --db-url <production-url>
   # Then restore from backup
   ```

3. **Frontend Rollback**:
   - Revert Vercel deployment to previous version
   - Update DNS if needed

4. **Notify Users**:
   - Post maintenance message
   - Send email if orders affected

---

**Final Check**: Have you read through this entire checklist? ✅

**Launch Date**: _____________

**Signed Off By**: _____________
