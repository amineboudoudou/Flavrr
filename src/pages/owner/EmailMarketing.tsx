import React, { useState } from 'react';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { api } from '../../lib/api';

export const EmailMarketing: React.FC = () => {
    const [formData, setFormData] = useState({
        name: '',
        subject: '',
        html_content: '',
        min_orders: 0,
        test_email: '',
    });
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState('');

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
                html_content: formData.html_content,
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
        if (!formData.name || !formData.subject || !formData.html_content) {
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
                html_content: formData.html_content,
                recipient_filter: {
                    min_orders: formData.min_orders || undefined,
                    email_marketing_consent: true,
                },
            });
            setMessage(`✓ Campaign created! Will be sent to ${result.recipients_count} customers.`);
            setFormData({
                name: '',
                subject: '',
                html_content: '',
                min_orders: 0,
                test_email: '',
            });
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
                                Email Content (HTML) *
                            </label>
                            <textarea
                                value={formData.html_content}
                                onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                                placeholder="<h1>Hello!</h1><p>We have a special offer for you...</p>"
                                rows={10}
                                className="w-full px-4 py-3 bg-surface border border-border rounded-[var(--radius)] text-text placeholder:text-muted focus:outline-none focus:border-primary font-mono text-sm"
                                disabled={sending}
                            />
                            <p className="text-muted text-xs mt-2">
                                Tip: Use HTML for formatting. Include images with full URLs.
                            </p>
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
                            disabled={sending || !formData.subject || !formData.html_content}
                            className="px-6 py-3 bg-surface text-text border border-border rounded-[var(--radius)] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-2"
                        >
                            {sending ? 'Sending...' : '📧 Send Test Email'}
                        </button>
                        <button
                            onClick={handleSendCampaign}
                            disabled={sending || !formData.name || !formData.subject || !formData.html_content}
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
