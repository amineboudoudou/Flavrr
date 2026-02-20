
export type Allergen = 'Gluten' | 'Dairy' | 'Nuts' | 'Vegan' | 'Spicy' | 'Shellfish';

export interface LocalizedString {
  fr: string;
  en: string;
}

export interface MenuItem {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  price: number;
  image: string;
  category: string;
  ingredients: LocalizedString[];
  allergens: Allergen[];
  isBestSeller?: boolean;
}

export interface Category {
  id: string;
  label: LocalizedString;
  image?: string;
  vibe?: LocalizedString;
}

export interface CartItem extends Omit<MenuItem, 'name' | 'description' | 'ingredients'> {
  name: LocalizedString;
  quantity: number;
}

export interface ThemeConfig {
  primary: string;
  accent: string;
  text: string;
  glass: string;
  cardBg: string;
}

export interface StorefrontReview {
  id: string;
  author: string;
  rating: number;
  comment: LocalizedString;
  avatar: string;
  images: string[];
}

export interface NewsPost {
  id: string;
  title: LocalizedString;
  date: LocalizedString;
  excerpt: LocalizedString;
  image: string;
}

export type ViewState = 'menu' | 'delivery' | 'booking' | 'news';
export type Language = 'fr' | 'en';

// ============================================
// OWNER PORTAL TYPES
// ============================================

export type UserRole = 'owner' | 'manager' | 'kitchen' | 'admin';

export type OrderStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'paid'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'canceled'
  | 'refunded';

export type FulfillmentType = 'pickup' | 'delivery';

export type PaymentProvider = 'stripe';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export type DeliveryProvider = 'uber_direct';

export type DeliveryStatus =
  | 'created'
  | 'courier_assigned'
  | 'picked_up'
  | 'dropped_off'
  | 'canceled'
  | 'failed';

export type NotificationType =
  | 'order_new'
  | 'order_paid'
  | 'order_status'
  | 'delivery_update';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  org_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItemSnapshot {
  id: string;
  name: string;
  price: number;
  quantity: number;
  modifiers?: string[];
  notes?: string;
}

export interface Order {
  id: string;
  org_id: string;
  order_number: number;
  public_token?: string;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;

  // Customer info
  customer_name: string;
  customer_email: string;
  customer_phone: string;

  // Items (snapshot at time of order)
  items: OrderItemSnapshot[];

  // Pricing
  subtotal: number;
  tax: number;
  tip: number;
  delivery_fee: number;
  total: number;

  // Delivery address (only if delivery)
  delivery_address?: {
    street: string;
    city: string;
    province: string;
    postal_code: string;
    special_instructions?: string;
  };

  // Metadata
  special_instructions?: string;
  internal_notes?: string;

  // New: Delivery Slots
  scheduled_for?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  ready_at?: string;
  completed_at?: string;

  // Uber Direct Integration
  uber_delivery_id?: string;
  uber_tracking_url?: string;
  uber_status?: string;
  uber_quote_id?: string;
  last_uber_sync_at?: string;

  // Stripe Financials
  stripe_fee_amount?: number;
  stripe_net_amount?: number;
  stripe_currency?: string;
}

export interface Delivery {
  id: string;
  order_id: string;
  org_id: string;
  provider: DeliveryProvider;
  status: DeliveryStatus;

  // Uber Direct specific
  external_delivery_id?: string;
  quote_id?: string;
  fee: number;
  eta_minutes?: number;
  tracking_url?: string;
  courier_name?: string;
  courier_phone?: string;
  courier_location?: {
    lat: number;
    lng: number;
  };

  // Timestamps
  created_at: string;
  updated_at: string;
  picked_up_at?: string;
  dropped_off_at?: string;
}

export interface BusinessHour {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface VerifiedAddress {
  street1: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  lat: number;
  lng: number;
  place_id: string;
  formatted?: string;
}

export interface OrganizationProfile {
  id: string;
  name: string;
  slug: string;
  street: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  address_json?: VerifiedAddress | null;
  address_text?: string | null;
  settings: {
    fulfillment_types?: FulfillmentType[];
    default_prep_time_minutes?: number;
    tax_rate?: number;
    [key: string]: any;
  };
  business_hours: BusinessHour[];
}

export interface OrgSettings {
  id: string;
  org_id: string;
  restaurant_name: string;
  is_open: boolean;
  default_prep_time_minutes: number;
  tax_rate: number;
  tips_enabled: boolean;
  pickup_address: {
    street: string;
    city: string;
    province: string;
    postal_code: string;
  };
  address_json?: VerifiedAddress | null;
  address_text?: string | null;
  business_hours?: BusinessHour[];
  created_at: string;
  updated_at: string;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export interface UberQuoteResponse {
  quote_id: string;
  fee: number;
  eta_minutes: number;
  expires_at: string;
}

export interface OrdersListResponse {
  orders: Order[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

// ============================================
// REVIEWS TYPES
// ============================================

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Review {
  id: string;
  org_id: string;
  order_id: string;
  customer_name: string;
  customer_email?: string;
  rating: number;
  comment?: string;
  images?: string[];
  status: ReviewStatus;
  admin_notes?: string;
  moderated_at?: string;
  moderated_by?: string;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewWithOrder extends Review {
  order: {
    order_number: number;
    total: number;
    created_at: string;
  };
}

// ============================================
// CUSTOMERS TYPES
// ============================================

export interface Customer {
  id: string;
  org_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  default_address?: any;
  marketing_opt_in: boolean;
  marketing_opt_in_at?: string;
  source?: string;
  total_orders: number;
  total_spent_cents: number;
  average_order_cents: number;
  last_order_at?: string;
  notes?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label?: string;
  street: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  use_count: number;
  last_used_at: string;
  created_at: string;
}

export interface CustomerDetails extends Customer {
  addresses: CustomerAddress[];
  recent_orders: Order[];
}

// ============================================
// EMAIL MARKETING TYPES
// ============================================

export type EmailCampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

export interface EmailCampaign {
  id: string;
  org_id: string;
  created_by: string;
  name: string;
  subject: string;
  html_content: string;
  recipient_filter: {
    min_orders?: number;
    max_orders?: number;
    last_order_days_ago?: number;
    tags?: string[];
    email_marketing_consent?: boolean;
  };
  status: EmailCampaignStatus;
  scheduled_for?: string;
  sent_at?: string;
  recipients_count: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  failed_count: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// PROMO CODES TYPES
// ============================================

export type DiscountType = 'percentage' | 'fixed_amount';

export interface PromoCode {
  id: string;
  org_id: string;
  created_by: string;
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_cents: number;
  max_discount_cents?: number;
  max_uses?: number;
  max_uses_per_customer: number;
  current_uses: number;
  is_active: boolean;
  starts_at?: string;
  expires_at?: string;
  applicable_category_ids?: string[];
  applicable_item_ids?: string[];
  total_revenue_cents: number;
  total_discount_given_cents: number;
  created_at: string;
  updated_at: string;
}

export interface PromoCodeUsage {
  id: string;
  promo_code_id: string;
  order_id: string;
  customer_email: string;
  discount_applied_cents: number;
  created_at: string;
}

// ============================================
// API RESPONSE TYPES FOR NEW FEATURES
// ============================================

export interface ReviewsListResponse {
  reviews: ReviewWithOrder[];
  total: number;
  stats: {
    average_rating: number;
    total_reviews: number;
    pending_count: number;
    approved_count: number;
    rejected_count: number;
  };
}

export interface CustomersListResponse {
  customers: Customer[];
  total: number;
}

export interface EmailCampaignsListResponse {
  campaigns: EmailCampaign[];
  total: number;
}

export interface PromoCodesListResponse {
  promo_codes: PromoCode[];
  total: number;
}

export type CheckoutStep = 'ITEMS' | 'DETAILS' | 'DELIVERY' | 'PAYMENT' | 'SUCCESS';
