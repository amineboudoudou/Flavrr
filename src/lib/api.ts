import { supabase } from './supabase';
import type {
    Order,
    OrdersListResponse,
    UberQuoteResponse,
    Delivery,
    OrderStatus,
    ReviewsListResponse,
    Review,
    ReviewStatus,
    CustomersListResponse,
    Customer,
    CustomerDetails,
    EmailCampaignsListResponse,
    EmailCampaign,
    PromoCodesListResponse,
    PromoCode,
    OrganizationProfile,
} from '../types';

/**
 * API wrapper for Owner Portal Edge Functions
 * Uses manual fetch with timeout protection to prevent infinite loading
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Derive the functions URL in a way that works with both legacy supabase.co/functions/v1
// and the newer functions.supabase.co domain. Normalize even if the env value uses the old host.
const EDGE_FUNCTION_URL = (() => {
    const normalize = (raw: string) => {
        try {
            const url = new URL(raw);
            // If already using functions domain, keep it
            if (url.hostname.includes('.functions.supabase.co')) return `${url.protocol}//${url.hostname}`;
            // Transform xyz.supabase.co[/functions/v1] -> xyz.functions.supabase.co
            const baseHost = url.hostname.replace('.supabase.co', '.functions.supabase.co');
            return `${url.protocol}//${baseHost}`;
        } catch {
            return raw;
        }
    };

    if (import.meta.env.VITE_EDGE_FUNCTION_URL) return normalize(import.meta.env.VITE_EDGE_FUNCTION_URL);
    if (!SUPABASE_URL) return '';
    try {
        return normalize(SUPABASE_URL);
    } catch {
        return `${SUPABASE_URL}/functions/v1`;
    }
})();

const API_TIMEOUT = 30000; // 30 seconds

class ApiError extends Error {
    constructor(public message: string, public code?: string, public status?: number) {
        super(message);
        this.name = 'ApiError';
    }
}

async function fetchWithAuth<T>(
    endpoint: string,
    options: { method?: string; body?: any; query?: Record<string, string> } = {}
): Promise<T> {
    let { data: { session } } = await supabase.auth.getSession();

    // Proactively refresh sessions that are expired or about to expire.
    // This avoids edge functions returning "Invalid JWT" for time-skew / stale tokens.
    const nowSeconds = Math.floor(Date.now() / 1000);
    const refreshSkewSeconds = 60;
    if (session?.expires_at && session.expires_at <= nowSeconds + refreshSkewSeconds) {
        const refreshed = await supabase.auth.refreshSession();
        session = refreshed.data.session ?? null;
    }

    if (!session) {
        throw new ApiError('No active session', 'UNAUTHORIZED', 401);
    }

    const url = new URL(`${EDGE_FUNCTION_URL}/${endpoint}`);
    if (options.query) {
        Object.entries(options.query).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
    }

    // Add timeout protection to prevent infinite loading
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
        const response = await fetch(url.toString(), {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': SUPABASE_ANON_KEY,
                'x-client-info': 'supabase-js-custom-fetch'
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch {
                errorData = { error: await response.text() };
            }

            const errorMsg = errorData.error || errorData.message || 'API request failed';

            console.error(`❌ API Error (${response.status}):`, {
                url: url.toString(),
                error: errorMsg,
                details: errorData.details,
                hint: errorData.hint
            });

            // REMOVED: Aggressive 401 redirect that was causing logout on status changes
            // The AuthGate component handles session expiration properly
            // Just throw the error and let the component handle it

            throw new ApiError(
                errorMsg,
                'API_ERROR',
                response.status
            );
        }

        return response.json();
    } catch (error: any) {
        clearTimeout(timeoutId);

        // AbortError is expected on page refresh/navigation - re-throw so caller can ignore
        if (error.name === 'AbortError') {
            throw error; // Let caller handle this
        }

        // Only convert to ApiError for real errors
        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError(
            error.message || 'Request failed',
            error.code || 'UNKNOWN_ERROR',
            error.status
        );
    }
}

// ============================================
// ORDER ENDPOINTS
// ============================================

export interface ListOrdersParams {
    orgId: string;
    statuses?: OrderStatus[];
    limit?: number;
    cursor?: string;
}

function transformOrder(order: any): Order {
    return {
        ...order,
        subtotal: (order.subtotal_cents || 0) / 100,
        tax: (order.tax_cents || 0) / 100,
        tip: (order.tip_cents || 0) / 100,
        delivery_fee: (order.delivery_fee_cents || 0) / 100,
        total: (order.total_cents || 0) / 100,
        items: (order.items || []).map((item: any) => ({
            ...item,
            name: item.name_snapshot || item.name, // Fallback if already transformed
            price: (item.price_cents_snapshot || item.price_cents || 0) / 100,
            quantity: item.quantity
        }))
    };
}

export async function listOrders(params: ListOrdersParams): Promise<OrdersListResponse> {
    const query: Record<string, string> = {
        org_id: params.orgId,
    };

    if (params.statuses && params.statuses.length > 0) {
        query.status = params.statuses.join(',');
    }
    if (params.limit) {
        query.limit = params.limit.toString();
    }
    if (params.cursor) {
        query.cursor = params.cursor;
    }

    const response = await fetchWithAuth<OrdersListResponse>('owner_list_orders', { query });
    return {
        ...response,
        orders: response.orders.map(transformOrder)
    };
}

export async function getOrder(orderId: string): Promise<Order> {
    const order = await fetchWithAuth<any>('owner_get_order', {
        query: { order_id: orderId }
    });
    return transformOrder(order);
}

export async function updateOrderStatus(
    orderId: string,
    status: OrderStatus
): Promise<Order> {
    // Special fetch for order status that doesn't redirect on 401
    let { data: { session } } = await supabase.auth.getSession();

    const nowSeconds = Math.floor(Date.now() / 1000);
    const refreshSkewSeconds = 60;
    if (session?.expires_at && session.expires_at <= nowSeconds + refreshSkewSeconds) {
        const refreshed = await supabase.auth.refreshSession();
        session = refreshed.data.session ?? null;
    }

    if (!session) {
        throw new ApiError('No active session', 'UNAUTHORIZED', 401);
    }

    const url = new URL(`${EDGE_FUNCTION_URL}/owner_update_order_status`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ order_id: orderId, new_status: status }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch {
                errorData = { error: await response.text() };
            }
            
            // Don't redirect on 401 - just throw the error so we can see it
            throw new ApiError(
                errorData.error || `Failed to update order status: ${response.status}`,
                'UPDATE_ERROR',
                response.status
            );
        }

        const data = await response.json();
        
        // Edge function returns partial order, fetch full order to prevent UI disappearing
        // The partial order lacks items, totals, and other fields OrdersBoard needs
        try {
            return await getOrder(orderId);
        } catch (fetchErr) {
            // Fallback to partial order if fetch fails, though this may cause UI issues
            const order = data?.order ?? data;
            return transformOrder(order);
        }
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error instanceof ApiError) throw error;
        throw new ApiError(error.message || 'Request failed', 'UNKNOWN_ERROR');
    }
}

export async function deleteOrder(orderId: string): Promise<void> {
    await fetchWithAuth('owner_delete_order', {
        method: 'POST',
        body: { order_id: orderId },
    });
}

export async function bulkDeleteOrders(orderIds: string[]): Promise<{ deleted: number }> {
    return fetchWithAuth<{ deleted: number }>('owner_bulk_delete_orders', {
        method: 'POST',
        body: { order_ids: orderIds },
    });
}

// ============================================
// UBER DIRECT ENDPOINTS
// ============================================

export async function getUberQuote(orderId: string): Promise<UberQuoteResponse> {
    return fetchWithAuth<UberQuoteResponse>('uber_quote', {
        query: { order_id: orderId }
    });
}

export async function createUberDelivery(
    orderId: string,
    quoteId?: string
): Promise<any> {
    return fetchWithAuth<any>('uber_create_delivery', {
        method: 'POST',
        body: { order_id: orderId },
    });
}

// ============================================
// PUBLIC ENDPOINTS (Storefront)
// ============================================

export async function publicListCategories(orgId: string): Promise<any[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
        const { data, error } = await supabase
            .from('menu_categories')
            .select('*')
            .eq('org_id', orgId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .abortSignal(controller.signal);

        clearTimeout(timeoutId);

        if (error) throw error;
        return data.map(cat => ({
            id: cat.id,
            label: { fr: cat.name_fr, en: cat.name_en },
            image: cat.image_url,
            vibe: { fr: cat.description_fr, en: cat.description_en }
        }));
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout while fetching categories');
        }
        throw error;
    }
}

export async function publicListMenuItems(orgId: string): Promise<any[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
        const { data, error } = await supabase
            .from('menu_items')
            .select('*')
            .eq('org_id', orgId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .abortSignal(controller.signal);

        clearTimeout(timeoutId);

        if (error) throw error;
        return data.map(item => ({
            id: item.id,
            name: { fr: item.name_fr, en: item.name_en },
            description: { fr: item.description_fr, en: item.description_en },
            price: item.price_cents / 100,
            image: item.image_url,
            category: item.category_id,
            ingredients: (item.ingredients || []).map((ing: string) => ({ fr: ing, en: ing })),
            allergens: item.allergens || [],
            isBestSeller: item.is_best_seller
        }));
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout while fetching menu items');
        }
        throw error;
    }
}

export async function publicCreateOrder(data: {
    org_id: string;
    customer: { name: string; email: string; phone: string };
    items: { id: string; quantity: number }[];
    fulfillment_type: 'pickup' | 'delivery';
    scheduled_for?: string;
    delivery_address?: any;
    instructions?: string;
}): Promise<{ success: boolean; order: any }> {
    const url = new URL(`${EDGE_FUNCTION_URL}/public_create_order`);

    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        let errorMsg = 'Failed to create order';
        try {
            const err = await response.json();
            errorMsg = err.error || errorMsg;
        } catch { }
        throw new Error(errorMsg);
    }

    return response.json();
}

export async function publicGetMenu(workspaceSlug: string): Promise<{
    workspace?: { id: string; name: string; slug: string };
    organization: OrganizationProfile;
    menu: any[];
}> {
    const url = new URL(`${EDGE_FUNCTION_URL}/public_get_menu`);
    url.searchParams.append('workspace_slug', workspaceSlug);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
        const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Failed to fetch menu: ${response.statusText}`);
        }

        const data = await response.json();

        // Transform the data to match the expected frontend format
        const transformedMenu = data.menu.map((cat: any) => ({
            id: cat.id,
            label: { fr: cat.name_fr, en: cat.name_en },
            image: cat.image_url,
            vibe: { fr: cat.description_fr, en: cat.description_en },
            items: cat.items.map((item: any) => ({
                id: item.id,
                name: { fr: item.name_fr, en: item.name_en },
                description: { fr: item.description_fr, en: item.description_en },
                price: item.price_cents / 100,
                image: item.image_url,
                category: item.category_id,
                ingredients: (item.ingredients || []).map((ing: string) => ({ fr: ing, en: ing })),
                allergens: item.allergens || [],
                isBestSeller: item.is_best_seller
            }))
        }));

        return {
            organization: data.organization,
            menu: transformedMenu
        };
    } catch (error: any) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// ============================================
// MENU MANAGEMENT
// ============================================

export async function ownerListMenuItems(): Promise<any[]> {
    return fetchWithAuth('owner_list_menu_items', { method: 'GET' })
        .then((res: any) => res.items || []);
}

export async function ownerListCategories(): Promise<any[]> {
    return fetchWithAuth('owner_list_categories', { method: 'GET' })
        .then((res: any) => res.categories || []);
}

export async function ownerListProducts(): Promise<any[]> {
    return fetchWithAuth('owner_list_products', { method: 'GET' })
        .then((res: any) => res.products || []);
}

export async function ownerCreateMenuItem(data: {
    name_fr: string;
    name_en: string;
    description_fr: string;
    description_en: string;
    price_cents: number;
    category_id: string;
    image_url?: string;
    allergens?: string[];
    ingredients?: string[];
    is_best_seller?: boolean;
}): Promise<any> {
    return fetchWithAuth('owner_create_menu_item', {
        method: 'POST',
        body: data
    }).then((res: any) => res.item);
}

export async function ownerUpdateMenuItem(item_id: string, updates: any): Promise<any> {
    return fetchWithAuth('owner_update_menu_item', {
        method: 'POST',
        body: { item_id, ...updates }
    }).then((res: any) => res.item);
}

export async function ownerDeleteMenuItem(item_id: string): Promise<void> {
    await fetchWithAuth('owner_delete_menu_item', {
        method: 'POST',
        body: { item_id }
    });
}

export async function ownerCreateCategory(data: {
    name_fr: string;
    name_en: string;
}): Promise<any> {
    return fetchWithAuth('owner_create_category', {
        method: 'POST',
        body: data
    }).then((res: any) => res.category);
}

export async function ownerDeleteCategory(category_id: string): Promise<void> {
    await fetchWithAuth('owner_delete_category', {
        method: 'POST',
        body: { category_id }
    });
}

// ============================================
// ORGANIZATION SETTINGS
// ============================================

export async function ownerGetOrganization(): Promise<any> {
    return fetchWithAuth('owner_get_organization', { method: 'GET' })
        .then((res: any) => res.organization);
}

export async function ownerUpdateOrganization(updates: any): Promise<any> {
    return fetchWithAuth('owner_update_organization', {
        method: 'POST',
        body: updates
    }).then((res: any) => res.organization);
}

// ============================================
// REVIEWS MANAGEMENT
// ============================================

export interface ListReviewsParams {
    status?: ReviewStatus;
    rating?: number;
    limit?: number;
    offset?: number;
}

export async function listReviews(params?: ListReviewsParams): Promise<ReviewsListResponse> {
    const query: Record<string, string> = {};

    if (params?.status) query.status = params.status;
    if (params?.rating) query.rating = params.rating.toString();
    if (params?.limit) query.limit = params.limit.toString();
    if (params?.offset) query.offset = params.offset.toString();

    return fetchWithAuth<ReviewsListResponse>('owner_list_reviews', { query });
}

export async function updateReviewStatus(
    reviewId: string,
    status: ReviewStatus,
    adminNotes?: string
): Promise<Review> {
    const response = await fetchWithAuth<{ success: boolean; review: Review }>('owner_update_review_status', {
        method: 'POST',
        body: { review_id: reviewId, status, admin_notes: adminNotes },
    });
    return response.review;
}

// ============================================
// CUSTOMERS MANAGEMENT
// ============================================

export interface ListCustomersParams {
    search?: string;
    min_orders?: number;
    sort?: 'total_spent' | 'order_count' | 'last_order_at';
    limit?: number;
    offset?: number;
}

export async function listCustomers(params?: ListCustomersParams): Promise<CustomersListResponse> {
    const query: Record<string, string> = {};

    if (params?.search) query.search = params.search;
    if (params?.min_orders) query.min_orders = params.min_orders.toString();
    if (params?.sort) query.sort = params.sort;
    if (params?.limit) query.limit = params.limit.toString();
    if (params?.offset) query.offset = params.offset.toString();

    return fetchWithAuth<CustomersListResponse>('owner_list_customers', { query });
}

export async function getCustomerDetails(customerId: string): Promise<CustomerDetails> {
    return fetchWithAuth<CustomerDetails>('owner_get_customer_details', {
        query: { customer_id: customerId }
    });
}

export async function exportMarketingCustomers(): Promise<{ customers: any[] }> {
    return fetchWithAuth<{ customers: any[] }>('owner_export_marketing_customers');
}

// ============================================
// EMAIL CAMPAIGNS
// ============================================

export interface SendEmailCampaignParams {
    name: string;
    subject: string;
    html_content: string;
    recipient_filter?: {
        min_orders?: number;
        max_orders?: number;
        last_order_days_ago?: number;
        tags?: string[];
        email_marketing_consent?: boolean;
    };
    schedule_for?: string;
    test_email?: string;
}

export async function sendEmailCampaign(params: SendEmailCampaignParams): Promise<{
    success: boolean;
    campaign_id?: string;
    recipients_count?: number;
    message: string;
}> {
    return fetchWithAuth('owner_send_email_campaign', {
        method: 'POST',
        body: params
    });
}

// ============================================
// PROMO CODES
// ============================================

export interface CreatePromoParams {
    code: string;
    description?: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: number;
    min_order_cents?: number;
    max_discount_cents?: number;
    max_uses?: number;
    max_uses_per_customer?: number;
    starts_at?: string;
    expires_at?: string;
    applicable_category_ids?: string[];
    applicable_item_ids?: string[];
    is_active?: boolean;
}

export async function createPromo(params: CreatePromoParams): Promise<PromoCode> {
    const response = await fetchWithAuth<{ success: boolean; promo_code: PromoCode }>('owner_create_promo', {
        method: 'POST',
        body: params
    });
    return response.promo_code;
}

export interface ListPromosParams {
    status?: 'active' | 'expired' | 'all';
    limit?: number;
    offset?: number;
}

export async function listPromos(params?: ListPromosParams): Promise<PromoCodesListResponse> {
    const query: Record<string, string> = {};

    if (params?.status) query.status = params.status;
    if (params?.limit) query.limit = params.limit.toString();
    if (params?.offset) query.offset = params.offset.toString();

    return fetchWithAuth<PromoCodesListResponse>('owner_list_promos', { query });
}

export async function updatePromo(promoId: string, updates: Partial<CreatePromoParams>): Promise<PromoCode> {
    const response = await fetchWithAuth<{ success: boolean; promo_code: PromoCode }>('owner_update_promo', {
        method: 'POST',
        body: { promo_id: promoId, ...updates }
    });
    return response.promo_code;
}
// PUBLIC API (STREETFLOW)
// ============================================

export async function publicCreatePaymentIntent(data: any) {
    // Ensure workspace slug fallback to avoid "Workspace not found" when org not yet loaded
    const payload = {
        ...data,
        workspace_slug: data?.workspace_slug,
    };
    // Add cache-busting for iOS Safari
    const url = new URL(`${EDGE_FUNCTION_URL}/create-payment-intent`);
    url.searchParams.set('t', Date.now().toString());
    
    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify(payload),
        cache: 'no-store' // Prevent iOS caching
    });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({ ok: false, code: 'UNKNOWN_ERROR', error: 'Request failed' }));
        
        // Create detailed error with status code
        const error: any = new Error(err.error || 'Failed to create payment intent');
        error.code = err.code || 'UNKNOWN_ERROR';
        error.status = response.status;
        error.requestId = err.requestId;
        
        throw error;
    }
    
    return response.json();
}

export const api = {
    // Orders
    listOrders,
    getOrder,
    updateOrderStatus,
    deleteOrder,
    bulkDeleteOrders,

    // Delivery
    getUberQuote,
    createUberDelivery,

    // Public Menu (for storefront)
    publicListCategories,
    publicListMenuItems,
    publicGetMenu,
    publicCreateOrder,
    publicCreatePaymentIntent,

    // Owner Menu Management
    ownerListMenuItems,
    ownerListCategories,
    ownerListProducts,
    ownerCreateMenuItem,
    ownerUpdateMenuItem,
    ownerDeleteMenuItem,
    ownerCreateCategory,
    ownerDeleteCategory,

    // Owner Organization Settings
    ownerGetOrganization,
    ownerUpdateOrganization,

    // Reviews Management
    listReviews,
    updateReviewStatus,

    // Customers Management
    listCustomers,
    getCustomerDetails,
    exportMarketingCustomers,

    // Email Campaigns
    sendEmailCampaign,

    // Stripe Connect
    connectOnboarding: async (): Promise<{ url: string }> => {
        // Ensure payout account exists, then request onboarding link
        await fetchWithAuth('connect-create-account', { method: 'POST', body: {} });
        return fetchWithAuth<{ url: string }>('connect-onboarding-link', { method: 'POST', body: {} });
    },
    // Used to refresh status after return
    connectRefresh: async (): Promise<any> => {
        // Just fetching the org again updates the local state if the backend logic relies on it,
        // but typically we might want a dedicated status check endpoint. 
        // For now, re-fetching the org profile is enough if we trust webhooks have fired,
        // or we can force a sync. 
        // Let's just rely on getting the org.
        return fetchWithAuth('owner_get_organization', { method: 'GET' })
            .then((res: any) => res.organization);
    },

    // Promo Codes
    createPromo,
    listPromos,
    updatePromo,
};

