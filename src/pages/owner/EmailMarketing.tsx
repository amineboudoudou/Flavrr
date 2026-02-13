import React, { useEffect, useMemo, useState } from 'react';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { api } from '../../lib/api';
import { useWorkspace } from '../../contexts/WorkspaceContext';

export const EmailMarketing: React.FC = () => {
    const { activeWorkspace } = useWorkspace();
    const [formData, setFormData] = useState({
        name: '',
        subject: '',
        preheader: '',
        headline: '',
        description: '',
        message: '',
        cta_text: '',
        cta_url: '',
        min_orders: 0,
        test_email: '',
    });
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        let mounted = true;
        const loadItems = async () => {
            try {
                const items = await api.ownerListMenuItems();
                if (mounted) setMenuItems(items || []);
            } catch (e) {
                console.error('Failed to load menu items:', e);
            }
        };
        loadItems();
        return () => {
            mounted = false;
        };
    }, []);

    const selectedProducts = useMemo(() => {
        const byId = new Map(menuItems.map((i) => [i.id, i]));
        return selectedProductIds.map((id) => byId.get(id)).filter(Boolean);
    }, [menuItems, selectedProductIds]);

    const escapeHtml = (input: string) =>
        input
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');

    const formatMessageToHtml = (input: string) => {
        const trimmed = (input || '').trim();
        if (!trimmed) return '';
        const paragraphs = trimmed
            .split(/\n\s*\n/g)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => `<p style="margin: 0 0 12px; line-height: 1.6;">${escapeHtml(p).replaceAll('\n', '<br/>')}</p>`)
            .join('');
        return paragraphs;
    };

    const storefrontBaseUrl = useMemo(() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const slug = activeWorkspace?.slug;
        if (!origin || !slug) return '';
        return `${origin}/order/${slug}`;
    }, [activeWorkspace?.slug]);

    const normalizedCtaUrl = useMemo(() => {
        const url = (formData.cta_url || '').trim();
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `https://${url}`;
    }, [formData.cta_url]);

    const applyTemplate = (template: 'promo' | 'new' | 'restock' | 'valentines') => {
        if (template === 'promo') {
            setFormData((prev) => ({
                ...prev,
                subject: prev.subject || 'A special offer for you',
                preheader: prev.preheader || 'Limited-time deal inside',
                headline: prev.headline || 'Limited-time offer',
                description: prev.description || 'Don’t miss our limited-time special.',
                message:
                    prev.message ||
                    'Hey there!\n\nWe’re running a limited-time offer this week. Tap below to order your favorites.\n\nSee you soon!',
                cta_text: prev.cta_text || 'Order now',
                cta_url: prev.cta_url || storefrontBaseUrl,
            }));
            return;
        }
        if (template === 'new') {
            setFormData((prev) => ({
                ...prev,
                subject: prev.subject || 'New items just dropped',
                preheader: prev.preheader || 'Fresh picks waiting for you',
                headline: prev.headline || 'New on the menu',
                description: prev.description || 'Fresh, delicious, and ready to order.',
                message:
                    prev.message ||
                    'Good news!\n\nWe just added new items to the menu. Check them out and place your order in seconds.',
                cta_text: prev.cta_text || 'View menu',
                cta_url: prev.cta_url || storefrontBaseUrl,
            }));
            return;
        }
        if (template === 'valentines') {
            setFormData((prev) => ({
                ...prev,
                subject: prev.subject || "Valentine’s special 💝", 
                preheader: prev.preheader || 'Limited-time Valentine’s picks inside',
                headline: prev.headline || 'Valentine’s special',
                description: prev.description || 'Treat someone (or yourself) to something delicious.',
                message:
                    prev.message ||
                    'Happy Valentine’s Day!\n\nWe curated a few favorites perfect for the occasion. Choose your items below and place your order in minutes.',
                cta_text: prev.cta_text || 'Order for Valentine’s',
                cta_url: prev.cta_url || storefrontBaseUrl,
            }));
            return;
        }
        setFormData((prev) => ({
            ...prev,
            subject: prev.subject || 'Back in stock',
            preheader: prev.preheader || 'Your favorites are available again',
            headline: prev.headline || 'Back in stock',
            description: prev.description || 'Your favorites are ready when you are.',
            message:
                prev.message ||
                'Just a quick note—your favorites are back and ready to order.\n\nTap below to grab them before they’re gone again!',
            cta_text: prev.cta_text || 'Order now',
            cta_url: prev.cta_url || storefrontBaseUrl,
        }));
    };

    const buildEmailHtml = () => {
        const bodyHtml = formatMessageToHtml(formData.message);
        const preheaderText = (formData.preheader || '').trim();
        const preheaderHtml = preheaderText
            ? `
                <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
                    ${escapeHtml(preheaderText)}
                </div>
            `
            : '';
        const headlineHtml = (formData.headline || '').trim()
            ? `<h1 style="margin: 0 0 12px; font-size: 24px; line-height: 1.2; font-weight: 800;">${escapeHtml(formData.headline.trim())}</h1>`
            : '';
        const descriptionText = (formData.description || '').trim();
        const descriptionHtml = descriptionText
            ? `<p style="margin: 0 0 14px; font-size: 16px; line-height: 1.6; color: #374151;">${escapeHtml(descriptionText)}</p>`
            : '';

        const ctaText = (formData.cta_text || '').trim();
        const ctaUrl = normalizedCtaUrl || storefrontBaseUrl || '';
        const ctaHtml = ctaText && ctaUrl
            ? `<div style="margin-top: 16px; margin-bottom: 8px;"><a href="${escapeHtml(ctaUrl)}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 16px; border-radius: 12px; font-weight: 700;">${escapeHtml(ctaText)}</a></div>`
            : '';

        const productsForEmail = selectedProducts.slice(0, 6);
        const productsHtml = productsForEmail.length
            ? `
                <div style="margin-top: 20px;">
                    <h2 style="font-size: 16px; margin: 0 0 12px;">Featured items</h2>
                    <div>
                        ${productsForEmail
                            .map((p: any) => {
                                const href = storefrontBaseUrl ? `${storefrontBaseUrl}?item=${encodeURIComponent(p.id)}` : '';
                                const title = escapeHtml(p.name_en || p.name_fr || 'Item');
                                const price = typeof p.price_cents === 'number' ? `$${(p.price_cents / 100).toFixed(2)}` : '';
                                const img = p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="${title}" style="width: 100%; max-width: 520px; border-radius: 12px; display: block;"/>` : '';
                                const cta = href
                                    ? `<a href="${href}" style="display: inline-block; margin-top: 10px; background: #f97316; color: #ffffff; text-decoration: none; padding: 10px 14px; border-radius: 10px; font-weight: 600;">Order now</a>`
                                    : '';
                                return `
                                    <div style="border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; margin-bottom: 12px;">
                                        ${img}
                                        <div style="margin-top: 10px;">
                                            <div style="font-size: 16px; font-weight: 700;">${title}</div>
                                            ${price ? `<div style="color: #6b7280; margin-top: 4px;">${price}</div>` : ''}
                                            ${cta}
                                        </div>
                                    </div>
                                `;
                            })
                            .join('')}
                    </div>
                    ${selectedProducts.length > productsForEmail.length ? `<p style="color: #6b7280; margin-top: 12px;">Showing ${productsForEmail.length} of ${selectedProducts.length} featured items. Consider featuring fewer items for better performance.</p>` : ''}
                </div>
            `
            : '';

        const brand = escapeHtml(activeWorkspace?.name || '');
        return `
            <div style="background: #f9fafb; padding: 16px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #111827;">
                <div style="max-width: 640px; margin: 0 auto;">
                    ${preheaderHtml}
                    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 18px;">
                        ${brand ? `<div style="font-size: 13px; color: #6b7280; margin-bottom: 10px;">${brand}</div>` : ''}
                        ${headlineHtml}
                        ${descriptionHtml}
                        ${bodyHtml}
                        ${ctaHtml}
                        ${productsHtml}
                        ${storefrontBaseUrl ? `<div style="margin-top: 18px;"><a href="${storefrontBaseUrl}" style="color: #2563eb; text-decoration: none;">View full menu</a></div>` : ''}
                    </div>
                </div>
            </div>
        `.trim();
    };

    const handleSendTest = async () => {
        if (!formData.test_email) {
            alert('Please enter a test email address');
            return;
        }

        try {
            setSending(true);
            setMessage('');
            await api.sendEmailCampaign({
                name: formData.name || 'Test Campaign',
                subject: formData.subject,
                html_content: buildEmailHtml(),
                test_email: formData.test_email,
            });
            setMessage('✓ Test email sent successfully!');
        } catch (error: any) {
            console.error('Error sending test:', error);
            setMessage(`✗ Error: ${error.message}`);
        } finally {
            setSending(false);
        }
    };

    const handleSendCampaign = async () => {
        if (!formData.name || !formData.subject || !formData.message) {
            alert('Please fill in all required fields');
            return;
        }

        if (!confirm('Are you sure you want to send this campaign to all eligible customers?')) {
            return;
        }

        try {
            setSending(true);
            setMessage('');
            const result = await api.sendEmailCampaign({
                name: formData.name,
                subject: formData.subject,
                html_content: buildEmailHtml(),
                recipient_filter: {
                    min_orders: formData.min_orders || undefined,
                    email_marketing_consent: true,
                },
            });
            setMessage(`✓ Campaign created! Will be sent to ${result.recipients_count} customers.`);
            setFormData({
                name: '',
                subject: '',
                preheader: '',
                headline: '',
                description: '',
                message: '',
                cta_text: '',
                cta_url: '',
                min_orders: 0,
                test_email: '',
            });
            setSelectedProductIds([]);
        } catch (error: any) {
            console.error('Error sending campaign:', error);
            setMessage(`✗ Error: ${error.message}`);
        } finally {
            setSending(false);
        }
    };

    return (
        <OwnerLayout>
            <div className="p-6 max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-text mb-2">Marketing</h1>
                    <p className="text-muted">Send targeted email campaigns to your customers</p>
                </div>

                {/* Campaign Form */}
                <div className="bg-surface border border-border rounded-[var(--radius)] p-6 mb-6 shadow-[var(--shadow)]">
                    <h2 className="text-xl font-bold text-text mb-6">Create Campaign</h2>

                    <div className="space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-surface-2 border border-border rounded-[var(--radius)] p-4">
                            <div>
                                <div className="text-text font-semibold">Start from a template</div>
                                <div className="text-muted text-xs">Pre-fill a campaign layout, then customize it</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => applyTemplate('promo')}
                                    disabled={sending}
                                    className="px-3 py-2 text-sm bg-surface border border-border rounded-[var(--radius)] hover:bg-surface-2 disabled:opacity-50"
                                >
                                    Promo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyTemplate('new')}
                                    disabled={sending}
                                    className="px-3 py-2 text-sm bg-surface border border-border rounded-[var(--radius)] hover:bg-surface-2 disabled:opacity-50"
                                >
                                    New items
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyTemplate('restock')}
                                    disabled={sending}
                                    className="px-3 py-2 text-sm bg-surface border border-border rounded-[var(--radius)] hover:bg-surface-2 disabled:opacity-50"
                                >
                                    Back in stock
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyTemplate('valentines')}
                                    disabled={sending}
                                    className="px-3 py-2 text-sm bg-surface border border-border rounded-[var(--radius)] hover:bg-surface-2 disabled:opacity-50"
                                >
                                    Valentine’s
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-muted text-sm font-medium mb-2">
                                Campaign Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Spring Promotion 2026"
                                className="w-full px-4 py-3 bg-surface border border-border rounded-[var(--radius)] text-text placeholder:text-muted focus:outline-none focus:border-primary"
                                disabled={sending}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-muted text-sm font-medium mb-2">
                                    Preheader
                                </label>
                                <input
                                    type="text"
                                    value={formData.preheader}
                                    onChange={(e) => setFormData({ ...formData, preheader: e.target.value })}
                                    placeholder="Short summary shown in inbox preview"
                                    className="w-full px-4 py-3 bg-surface border border-border rounded-[var(--radius)] text-text placeholder:text-muted focus:outline-none focus:border-primary"
                                    disabled={sending}
                                />
                                <p className="text-muted text-xs mt-1">Optional, but increases open rates.</p>
                            </div>
                            <div>
                                <label className="block text-muted text-sm font-medium mb-2">
                                    Headline
                                </label>
                                <input
                                    type="text"
                                    value={formData.headline}
                                    onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                                    placeholder="Big title inside the email"
                                    className="w-full px-4 py-3 bg-surface border border-border rounded-[var(--radius)] text-text placeholder:text-muted focus:outline-none focus:border-primary"
                                    disabled={sending}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-muted text-sm font-medium mb-2">
                                Short description
                            </label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="A short line that explains the offer"
                                className="w-full px-4 py-3 bg-surface border border-border rounded-[var(--radius)] text-text placeholder:text-muted focus:outline-none focus:border-primary"
                                disabled={sending}
                            />
                            <p className="text-muted text-xs mt-1">This appears under the title in the email.</p>
                        </div>

                        <div>
                            <label className="block text-muted text-sm font-medium mb-2">
                                Email Subject *
                            </label>
                            <input
                                type="text"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                placeholder="Special Offer Just for You!"
                                className="w-full px-4 py-3 bg-surface border border-border rounded-[var(--radius)] text-text placeholder:text-muted focus:outline-none focus:border-primary"
                                disabled={sending}
                            />
                        </div>

                        <div>
                            <label className="block text-muted text-sm font-medium mb-2">
                                Email message *
                            </label>
                            <textarea
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                placeholder="Write your message here...\n\nExample: Hey! We have a special offer for you this week."
                                rows={10}
                                className="w-full px-4 py-3 bg-surface border border-border rounded-[var(--radius)] text-text placeholder:text-muted focus:outline-none focus:border-primary text-sm"
                                disabled={sending}
                            />
                            <p className="text-muted text-xs mt-2">
                                Use new lines to separate paragraphs. Products you select below will be added automatically with “Order now” links.
                            </p>
                        </div>

                        <div className="bg-surface-2 border border-border rounded-[var(--radius)] p-4">
                            <div className="text-text font-semibold">Call to action button</div>
                            <div className="text-muted text-xs mb-3">Optional button to drive clicks (menu, promo page, etc.)</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-muted text-sm font-medium mb-2">Button text</label>
                                    <input
                                        type="text"
                                        value={formData.cta_text}
                                        onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })}
                                        placeholder="Order now"
                                        className="w-full px-4 py-3 bg-surface border border-border rounded-[var(--radius)] text-text placeholder:text-muted focus:outline-none focus:border-primary"
                                        disabled={sending}
                                    />
                                </div>
                                <div>
                                    <label className="block text-muted text-sm font-medium mb-2">Button link</label>
                                    <input
                                        type="text"
                                        value={formData.cta_url}
                                        onChange={(e) => setFormData({ ...formData, cta_url: e.target.value })}
                                        placeholder={storefrontBaseUrl || 'https://yourstore.com/order'}
                                        className="w-full px-4 py-3 bg-surface border border-border rounded-[var(--radius)] text-text placeholder:text-muted focus:outline-none focus:border-primary"
                                        disabled={sending}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface-2 border border-border rounded-[var(--radius)] p-4">
                            <div className="flex items-center justify-between gap-4 mb-3">
                                <div>
                                    <div className="text-text font-semibold">Featured products</div>
                                    <div className="text-muted text-xs">Pick items to include in the email with clickable links</div>
                                </div>
                                <div className="text-muted text-xs">
                                    {selectedProductIds.length} selected
                                </div>
                            </div>

                            <input
                                type="text"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder="Search products..."
                                className="w-full px-3 py-2 bg-surface border border-border rounded-[var(--radius)] text-text placeholder:text-muted focus:outline-none focus:border-primary text-sm"
                                disabled={sending}
                            />

                            <div className="mt-3 max-h-56 overflow-auto divide-y divide-border border border-border rounded-[var(--radius)] bg-surface">
                                {menuItems
                                    .filter((item) => {
                                        if (!productSearch.trim()) return true;
                                        const q = productSearch.trim().toLowerCase();
                                        const name = `${item?.name_en || ''} ${item?.name_fr || ''}`.toLowerCase();
                                        return name.includes(q);
                                    })
                                    .slice(0, 100)
                                    .map((item) => {
                                        const checked = selectedProductIds.includes(item.id);
                                        return (
                                            <label key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm text-text cursor-pointer hover:bg-surface-2">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        const next = e.target.checked
                                                            ? Array.from(new Set([...selectedProductIds, item.id]))
                                                            : selectedProductIds.filter((id) => id !== item.id);
                                                        setSelectedProductIds(next);
                                                    }}
                                                    disabled={sending}
                                                />
                                                <span className="flex-1">
                                                    {item.name_en || item.name_fr || 'Untitled'}
                                                </span>
                                                {typeof item.price_cents === 'number' && (
                                                    <span className="text-muted">${(item.price_cents / 100).toFixed(2)}</span>
                                                )}
                                            </label>
                                        );
                                    })}
                                {menuItems.length === 0 && (
                                    <div className="px-3 py-3 text-sm text-muted">No products found.</div>
                                )}
                            </div>

                            {selectedProductIds.length > 3 && (
                                <div className="mt-3 text-xs text-muted">
                                    For best conversions on mobile, featuring 1–3 products usually performs better.
                                </div>
                            )}

                            {!activeWorkspace?.slug && (
                                <div className="mt-3 text-xs text-muted">
                                    Product links will appear after you select a workspace.
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-surface border border-border rounded-[var(--radius)] p-4">
                                <div className="text-text font-semibold mb-2">Preview</div>
                                <div className="text-muted text-xs mb-3">
                                    This is what customers will see in their inbox.
                                </div>
                                <div className="border border-border rounded-[var(--radius)] bg-white p-4 overflow-auto max-h-80">
                                    <div
                                        dangerouslySetInnerHTML={{ __html: buildEmailHtml() }}
                                    />
                                </div>
                            </div>

                            <div className="bg-surface border border-border rounded-[var(--radius)] p-4">
                                <div className="text-text font-semibold mb-2">Quick tips</div>
                                <div className="text-muted text-sm space-y-2">
                                    <div>Keep it short and include one clear call-to-action.</div>
                                    <div>Use “Send test email” first to verify the links.</div>
                                    <div>Featuring 1–3 products usually converts better than a long list.</div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-muted text-sm font-medium mb-2">
                                    Minimum Orders (Filter)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.min_orders}
                                    onChange={(e) => setFormData({ ...formData, min_orders: parseInt(e.target.value) || 0 })}
                                    placeholder="0"
                                    className="w-full px-4 py-3 bg-surface border border-border rounded-[var(--radius)] text-text placeholder:text-muted focus:outline-none focus:border-primary"
                                    disabled={sending}
                                />
                                <p className="text-muted text-xs mt-1">
                                    Only send to customers with at least this many orders
                                </p>
                            </div>

                            <div>
                                <label className="block text-muted text-sm font-medium mb-2">
                                    Test Email Address
                                </label>
                                <input
                                    type="email"
                                    value={formData.test_email}
                                    onChange={(e) => setFormData({ ...formData, test_email: e.target.value })}
                                    placeholder="your@email.com"
                                    className="w-full px-4 py-3 bg-surface border border-border rounded-[var(--radius)] text-text placeholder:text-muted focus:outline-none focus:border-primary"
                                    disabled={sending}
                                />
                                <p className="text-muted text-xs mt-1">
                                    Send a test email to this address first
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 mt-6">
                        <button
                            onClick={handleSendTest}
                            disabled={sending || !formData.subject || !formData.message}
                            className="px-6 py-3 bg-surface text-text border border-border rounded-[var(--radius)] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-2"
                        >
                            {sending ? 'Sending...' : '📧 Send Test Email'}
                        </button>
                        <button
                            onClick={handleSendCampaign}
                            disabled={sending || !formData.name || !formData.subject || !formData.message}
                            className="px-6 py-3 bg-primary hover:bg-accent text-white rounded-[var(--radius)] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[var(--shadow)]"
                        >
                            {sending ? 'Sending...' : '🚀 Send Campaign'}
                        </button>
                    </div>

                    {/* Message */}
                    {message && (
                        <div className={`mt-4 p-4 rounded-[var(--radius)] border ${message.startsWith('✓')
                                ? 'bg-green-500/10 text-green-700 border-green-200'
                                : 'bg-red-500/10 text-red-700 border-red-200'
                            }`}>
                            {message}
                        </div>
                    )}
                </div>

                {/* Info Box */}
                <div className="bg-surface-2 border border-border rounded-[var(--radius)] p-6">
                    <h3 className="text-text font-bold mb-2">📝 Email Marketing Tips</h3>
                    <ul className="text-muted text-sm space-y-2">
                        <li>• Only customers who opted in to marketing emails will receive campaigns</li>
                        <li>• Always send a test email to yourself first to check formatting</li>
                        <li>• Use clear subject lines and compelling content</li>
                        <li>• Include a call-to-action (e.g., "Order Now", "View Menu")</li>
                        <li>• Personalize when possible to increase engagement</li>
                    </ul>
                </div>
            </div>
        </OwnerLayout>
    );
};
