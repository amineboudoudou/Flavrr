import { supabase } from './supabase';
import type {
    Order,
    OrdersListResponse,
    UberQuoteResponse,
    Delivery,
    OrderStatus,
} from '../types';

/**
 * API wrapper for Owner Portal Edge Functions
 * Uses manual fetch with timeout protection to prevent infinite loading
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const EDGE_FUNCTION_URL = import.meta.env.VITE_EDGE_FUNCTION_URL ||
    (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '');

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
    const { data: { session } } = await supabase.auth.getSession();

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

            throw new ApiError(
                errorData.error || errorData.message || 'API request failed',
                'API_ERROR',
                response.status
            );
        }

        return response.json();
    } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new ApiError(
                'Request timeout - please check your connection',
                'TIMEOUT',
                408
            );
        }

        throw error;
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

    return fetchWithAuth<OrdersListResponse>('owner_list_orders', { query });
}

export async function getOrder(orderId: string): Promise<Order> {
    return fetchWithAuth<Order>('owner_get_order', {
        query: { order_id: orderId }
    });
}

export async function updateOrderStatus(
    orderId: string,
    status: OrderStatus
): Promise<Order> {
    const response = await fetchWithAuth<{ success: boolean; order: Order }>('owner_update_order_status', {
        method: 'POST',
        body: { order_id: orderId, new_status: status },
    });
    return response.order;
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
    quoteId: string
): Promise<Delivery> {
    return fetchWithAuth<Delivery>('uber_create_delivery', {
        method: 'POST',
        body: { order_id: orderId, quote_id: quoteId },
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
            label: { fr: cat.name_fr, en: cat.name_en }
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

export const api = {
    listOrders,
    getOrder,
    updateOrderStatus,
    getUberQuote,
    createUberDelivery,
    publicListCategories,
    publicListMenuItems
};
