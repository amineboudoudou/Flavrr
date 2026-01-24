
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

export interface Review {
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

  // Timestamps
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  ready_at?: string;
  completed_at?: string;
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
