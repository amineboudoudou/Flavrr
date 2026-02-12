import React, { useEffect, useState } from 'react';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { BrandedLoader } from '../../components/owner/BrandedLoader';
import { api } from '../../lib/api';
import { AddressAutocomplete, type AddressComponents } from '../../components/AddressAutocomplete';
import type { VerifiedAddress } from '../../types';

interface BusinessHour {
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
}



interface BankingInfo {
    account_holder_name: string;
    bank_name: string;
    transit_number: string; // 5 digits
    institution_number: string; // 3 digits
    account_number: string; // 7-12 digits usually
}

interface OrgSettings {
    id: string;
    name: string;
    slug: string;
    phone: string;
    email: string;
    street: string;
    city: string;
    region: string;
    postal_code: string;
    country: string;
    address_json?: VerifiedAddress | null;
    address_text?: string | null;
    stripe_account_id?: string;
    stripe_account_status?: string;
    settings: {
        fulfillment_types?: ('delivery' | 'pickup')[];
        delivery_opening_time?: string;
        tax_rate?: number;
        default_prep_time_minutes?: number;
        banking?: BankingInfo;
    };
    business_hours?: BusinessHour[];
}

export const Settings: React.FC = () => {
    const [settings, setSettings] = useState<OrgSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [activeTab, setActiveTab] = useState<'general' | 'storefront' | 'banking'>('general');
    const [addressInputValue, setAddressInputValue] = useState('');
    const [addressVerified, setAddressVerified] = useState(false);
    const [addressError, setAddressError] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        loadSettings();

        // Check for Connect return
        const params = new URLSearchParams(window.location.search);
        const connectStatus = params.get('connect');
        if (connectStatus === 'return') {
            setSuccessMessage('🔄 Verifying account status...');
            // Force a refresh after a slight delay to allow webhook to process
            setTimeout(() => {
                loadSettings();
                setSuccessMessage('✅ Account connected successfully!');
                // Clean URL
                window.history.replaceState({}, '', window.location.pathname);
            }, 2000);
        } else if (connectStatus === 'refresh') {
            setSuccessMessage('⚠️ Connection incomplete. Please try again.');
        }
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const org = await api.ownerGetOrganization();
            // Initialize fulfillment_types if not set
            if (!org.settings.fulfillment_types) {
                org.settings.fulfillment_types = ['delivery', 'pickup'];
            }
            // Initialize banking if not set
            if (!org.settings.banking) {
                org.settings.banking = {
                    account_holder_name: '',
                    bank_name: '',
                    transit_number: '',
                    institution_number: '',
                    account_number: ''
                };
            }
            setSettings(org);
            
            // Initialize address state
            if (org.address_json) {
                setAddressVerified(true);
                setAddressInputValue(org.address_text || org.address_json.formatted || org.street || '');
            } else {
                setAddressInputValue(org.street || '');
                setAddressVerified(false);
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;

        // Validate address if it has been modified
        if (addressInputValue && !addressVerified) {
            setAddressError('Please select a valid address from suggestions');
            setSuccessMessage('❌ Address must be verified before saving');
            setTimeout(() => setSuccessMessage(''), 3000);
            return;
        }

        try {
            setSaving(true);
            await api.ownerUpdateOrganization(settings);
            setSuccessMessage('✅ Settings saved successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error: any) {
            console.error('Failed to save settings:', error);
            const errorMsg = error?.message || 'Failed to save settings';
            setSuccessMessage(`❌ ${errorMsg}`);
            setTimeout(() => setSuccessMessage(''), 3000);
        } finally {
            setSaving(false);
        }
    };

    const updateField = (field: string, value: any) => {
        if (!settings) return;
        setSettings({ ...settings, [field]: value });
    };

    const updateSettingsField = (field: string, value: any) => {
        if (!settings) return;
        setSettings({
            ...settings,
            settings: { ...settings.settings, [field]: value }
        });
    };

    const updateBankingField = (field: keyof BankingInfo, value: string) => {
        if (!settings) return;
        setSettings({
            ...settings,
            settings: {
                ...settings.settings,
                banking: {
                    ...settings.settings.banking,
                    [field]: value
                } as BankingInfo
            }
        });
    };

    const toggleFulfillmentType = (type: 'delivery' | 'pickup') => {
        if (!settings) return;
        const current = settings.settings.fulfillment_types || [];
        const updated = current.includes(type)
            ? current.filter(t => t !== type)
            : [...current, type];
        updateSettingsField('fulfillment_types', updated);
    };

    const updateBusinessHour = (day: number, field: keyof BusinessHour, value: any) => {
        if (!settings) return;
        const currentHours = settings.business_hours || [];
        const updatedHours = [...currentHours];
        const index = updatedHours.findIndex(h => h.day_of_week === day);

        if (index > -1) {
            updatedHours[index] = { ...updatedHours[index], [field]: value };
        } else {
            updatedHours.push({
                day_of_week: day,
                open_time: '09:00',
                close_time: '21:00',
                is_closed: false,
                [field]: value
            } as BusinessHour);
        }
        setSettings({ ...settings, business_hours: updatedHours });
    };

    const handleAddressSelect = (address: AddressComponents) => {
        if (!settings) return;
        
        const verifiedAddress: VerifiedAddress = {
            street1: address.street,
            city: address.city,
            province: address.region,
            postal_code: address.postal_code,
            country: address.country,
            lat: address.lat,
            lng: address.lng,
            place_id: address.place_id || '',
            formatted: address.formatted_address,
        };

        setSettings({
            ...settings,
            street: address.street,
            city: address.city,
            region: address.region,
            postal_code: address.postal_code,
            country: address.country,
            address_json: verifiedAddress,
            address_text: address.formatted_address || address.street,
        });
        
        setAddressVerified(true);
        setAddressError('');
    };

    const handleAddressInputChange = (value: string) => {
        setAddressInputValue(value);
        if (addressVerified) {
            setAddressVerified(false);
            setAddressError('Address changed - please select from suggestions to verify');
        }
    };

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


    if (loading) {
        return (
            <OwnerLayout>
                <BrandedLoader fullPage message="Loading settings…" />
            </OwnerLayout>
        );
    }

    if (!settings) {
        return (
            <OwnerLayout>
                <div className="flex items-center justify-center h-screen">
                    <div className="text-red-400">Failed to load settings</div>
                </div>
            </OwnerLayout>
        );
    }

    const fulfillmentTypes = settings.settings.fulfillment_types || [];

    return (
        <OwnerLayout>
            <div className="p-6 max-w-4xl">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-text text-2xl font-bold mb-2">Settings</h1>
                    <p className="text-muted text-sm">
                        Configure your restaurant information and delivery options
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-8 border-b border-border">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`pb-4 px-2 text-sm font-medium transition-colors relative ${activeTab === 'general' ? 'text-text' : 'text-muted hover:text-text'}`}
                    >
                        General
                        {activeTab === 'general' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('storefront')}
                        className={`pb-4 px-2 text-sm font-medium transition-colors relative ${activeTab === 'storefront' ? 'text-text' : 'text-muted hover:text-text'}`}
                    >
                        Storefront Link
                        {activeTab === 'storefront' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('banking')}
                        className={`pb-4 px-2 text-sm font-medium transition-colors relative ${activeTab === 'banking' ? 'text-text' : 'text-muted hover:text-text'}`}
                    >
                        Banking & Payouts
                        {activeTab === 'banking' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
                    </button>
                </div>

                {/* Success Message */}
                {successMessage && (
                    <div className={`mb-6 border px-4 py-3 rounded-lg ${successMessage.includes('✅')
                        ? 'bg-green-500/10 border-green-200 text-green-700'
                        : 'bg-red-500/10 border-red-200 text-red-700'
                        }`}>
                        {successMessage}
                    </div>
                )}

                {/* Content */}
                <div className="space-y-6">

                    {/* General Tab */}
                    {activeTab === 'general' && (
                        <>
                            {/* Restaurant Info */}
                            <div className="bg-surface border border-border rounded-[var(--radius)] p-6 shadow-[var(--shadow)]">
                                <h2 className="text-text text-lg font-semibold mb-4">Restaurant Information</h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-muted text-sm mb-2">Restaurant Name</label>
                                        <input
                                            type="text"
                                            value={settings.name}
                                            onChange={(e) => updateField('name', e.target.value)}
                                            className="w-full bg-surface border border-border rounded-[var(--radius)] px-4 py-2 text-text"
                                            placeholder="Café Du Griot"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-muted text-sm mb-2">Phone</label>
                                            <input
                                                type="tel"
                                                value={settings.phone || ''}
                                                onChange={(e) => updateField('phone', e.target.value)}
                                                className="w-full bg-surface border border-border rounded-[var(--radius)] px-4 py-2 text-text"
                                                placeholder="+1 (555) 123-4567"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-muted text-sm mb-2">Email</label>
                                            <input
                                                type="email"
                                                value={settings.email || ''}
                                                onChange={(e) => updateField('email', e.target.value)}
                                                className="w-full bg-surface border border-border rounded-[var(--radius)] px-4 py-2 text-text"
                                                placeholder="contact@restaurant.com"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Address */}
                            <div className="bg-neutral-800 border border-white/10 rounded-xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-white text-lg font-semibold">Restaurant Address</h2>
                                    {addressVerified && (
                                        <span className="flex items-center gap-2 text-green-400 text-sm font-medium bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            Verified
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-white/70 text-sm mb-2">
                                            Search Address (Google Places)
                                        </label>
                                        <AddressAutocomplete
                                            onAddressSelect={handleAddressSelect}
                                            value={addressInputValue}
                                            onValueChange={handleAddressInputChange}
                                            placeholder="Start typing your restaurant address..."
                                            restrictCountries={['ca', 'us']}
                                            className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:border-pink-500 focus:outline-none transition-colors"
                                        />
                                        {addressError && (
                                            <p className="text-red-400 text-xs mt-1">{addressError}</p>
                                        )}
                                        {!addressVerified && addressInputValue && (
                                            <p className="text-yellow-400 text-xs mt-1">⚠️ Please select a valid address from suggestions</p>
                                        )}
                                    </div>

                                    {addressVerified && settings.address_json && (
                                        <div className="bg-neutral-900/50 border border-white/5 rounded-lg p-4 space-y-2">
                                            <p className="text-white/40 text-xs uppercase tracking-wider font-semibold">Verified Details</p>
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <span className="text-white/50">Street:</span>
                                                    <span className="text-white ml-2">{settings.address_json.street1}</span>
                                                </div>
                                                <div>
                                                    <span className="text-white/50">City:</span>
                                                    <span className="text-white ml-2">{settings.address_json.city}</span>
                                                </div>
                                                <div>
                                                    <span className="text-white/50">Province:</span>
                                                    <span className="text-white ml-2">{settings.address_json.province}</span>
                                                </div>
                                                <div>
                                                    <span className="text-white/50">Postal:</span>
                                                    <span className="text-white ml-2">{settings.address_json.postal_code}</span>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-white/50">Coordinates:</span>
                                                    <span className="text-white ml-2 font-mono text-xs">
                                                        {settings.address_json.lat.toFixed(6)}, {settings.address_json.lng.toFixed(6)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Fulfillment Options */}
                            <div className="bg-neutral-800 border border-white/10 rounded-xl p-6">
                                <h2 className="text-white text-lg font-semibold mb-4">Fulfillment Options</h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-white/70 text-sm mb-3">Available Services</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={fulfillmentTypes.includes('delivery')}
                                                    onChange={() => toggleFulfillmentType('delivery')}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-white">🚚 Delivery</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={fulfillmentTypes.includes('pickup')}
                                                    onChange={() => toggleFulfillmentType('pickup')}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-white">🏃 Pickup</span>
                                            </label>
                                        </div>
                                    </div>

                                    {fulfillmentTypes.includes('delivery') && (
                                        <div>
                                            <label className="block text-white/70 text-sm mb-2">Delivery Opening Time</label>
                                            <input
                                                type="time"
                                                value={settings.settings.delivery_opening_time || '09:00'}
                                                onChange={(e) => updateSettingsField('delivery_opening_time', e.target.value)}
                                                className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-2 text-white"
                                            />
                                            <p className="text-white/40 text-xs mt-1">When delivery service starts</p>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-white/70 text-sm mb-2">Preparation Time (minutes)</label>
                                        <input
                                            type="number"
                                            value={settings.settings.default_prep_time_minutes || 30}
                                            onChange={(e) => updateSettingsField('default_prep_time_minutes', parseInt(e.target.value))}
                                            className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2 text-white"
                                            placeholder="30"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Business Hours */}
                            <div className="bg-neutral-800 border border-white/10 rounded-xl p-6">
                                <h2 className="text-white text-lg font-semibold mb-2">Business Hours</h2>
                                <p className="text-white/60 text-sm mb-6">
                                    Define when your restaurant is open and accepting orders.
                                </p>

                                <div className="space-y-4">
                                    {dayNames.map((day, index) => {
                                        const hour = (settings.business_hours || []).find(h => h.day_of_week === index) || {
                                            day_of_week: index,
                                            open_time: '09:00',
                                            close_time: '21:00',
                                            is_closed: false
                                        };

                                        return (
                                            <div key={day} className="flex flex-col md:flex-row md:items-center justify-between py-3 border-b border-white/5 last:border-0 gap-4">
                                                <div className="w-32">
                                                    <span className="text-white font-medium">{day}</span>
                                                </div>

                                                <div className="flex flex-1 items-center gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={!hour.is_closed}
                                                            onChange={(e) => updateBusinessHour(index, 'is_closed', !e.target.checked)}
                                                            className="w-4 h-4 rounded border-white/10"
                                                        />
                                                        <span className="text-white/70 text-sm">{hour.is_closed ? 'Closed' : 'Open'}</span>
                                                    </label>

                                                    {!hour.is_closed && (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="time"
                                                                value={hour.open_time.substring(0, 5)}
                                                                onChange={(e) => updateBusinessHour(index, 'open_time', e.target.value)}
                                                                className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-1 text-white text-sm"
                                                            />
                                                            <span className="text-white/30">to</span>
                                                            <input
                                                                type="time"
                                                                value={hour.close_time.substring(0, 5)}
                                                                onChange={(e) => updateBusinessHour(index, 'close_time', e.target.value)}
                                                                className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-1 text-white text-sm"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Storefront Link Tab */}
                    {activeTab === 'storefront' && (
                        <div className="space-y-6">
                            {/* Main Card */}
                            <div className="bg-neutral-800 border border-white/10 rounded-xl p-6">
                                <div className="mb-6">
                                    <h2 className="text-white text-lg font-semibold mb-2">Your Ordering Link</h2>
                                    <p className="text-white/60 text-sm">
                                        Share this link with your customers on Instagram, TikTok, or anywhere else. They can browse your menu and place orders directly.
                                    </p>
                                </div>

                                {/* Link Display & Copy */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-white/70 text-sm mb-2 font-medium">Your Custom Link</label>
                                        <div className="flex gap-3">
                                            <div className="flex-1 bg-neutral-900 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm flex items-center">
                                                <span className="text-white/40 mr-1">https://flavrr.app/</span>
                                                <span className="text-primary font-semibold">{settings.slug}</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const link = `https://flavrr.app/${settings.slug}`;
                                                    navigator.clipboard.writeText(link);
                                                    setCopied(true);
                                                    setTimeout(() => setCopied(false), 2000);
                                                }}
                                                className="bg-primary hover:bg-accent text-white px-6 py-3 rounded-lg transition-colors font-medium flex items-center gap-2 whitespace-nowrap"
                                            >
                                                {copied ? (
                                                    <>
                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                        Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                        Copy Link
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Slug Customization */}
                                    <div className="bg-neutral-900/50 border border-white/5 rounded-lg p-5">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                                                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-white font-medium mb-1">Want to customize your link?</h3>
                                                <p className="text-white/60 text-sm mb-3">
                                                    Your link slug is currently <span className="text-primary font-mono">{settings.slug}</span>. Contact support if you'd like to change it to match your brand better.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Usage Tips */}
                            <div className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-xl p-6">
                                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                    Pro Tips for Maximum Orders
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-400 text-xs font-bold">1</div>
                                        <div>
                                            <p className="text-white font-medium text-sm">Instagram Bio</p>
                                            <p className="text-white/60 text-sm">Add your link to your Instagram bio so followers can order instantly</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-400 text-xs font-bold">2</div>
                                        <div>
                                            <p className="text-white font-medium text-sm">TikTok & Stories</p>
                                            <p className="text-white/60 text-sm">Share your link in TikTok videos and Instagram stories to drive traffic</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-400 text-xs font-bold">3</div>
                                        <div>
                                            <p className="text-white font-medium text-sm">QR Code</p>
                                            <p className="text-white/60 text-sm">Generate a QR code for your link and add it to flyers, packaging, or your storefront</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 bg-pink-500/20 rounded-full flex items-center justify-center text-pink-400 text-xs font-bold">4</div>
                                        <div>
                                            <p className="text-white font-medium text-sm">WhatsApp & SMS</p>
                                            <p className="text-white/60 text-sm">Send your link directly to customers via WhatsApp or text message</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* QR Code Section */}
                            <div className="bg-neutral-800 border border-white/10 rounded-xl p-6">
                                <h3 className="text-white font-semibold mb-2">QR Code</h3>
                                <p className="text-white/60 text-sm mb-4">
                                    Generate a QR code that links directly to your storefront. Perfect for print materials!
                                </p>
                                <a
                                    href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https://flavrr.app/${settings.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Download QR Code
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Banking Tab */}
                    {activeTab === 'banking' && (
                        <div className="bg-neutral-800 border border-white/10 rounded-xl p-6">
                            <h2 className="text-white text-lg font-semibold mb-2">Payouts & Stripe Connect</h2>
                            <p className="text-white/60 text-sm mb-6">
                                Connect your bank account via Stripe to receive payouts automatically.
                            </p>

                            <div className="space-y-6">
                                {/* Connect Status Card */}
                                <div className={`border rounded-lg p-5 ${settings.stripe_account_status === 'complete' || settings.stripe_account_status === 'details_submitted'
                                    ? 'bg-green-500/10 border-green-500/30'
                                    : 'bg-neutral-900 border-white/10'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-white font-medium mb-1">
                                                {settings.stripe_account_status === 'complete'
                                                    ? '✅ Payouts Active'
                                                    : (settings.stripe_account_status === 'details_submitted'
                                                        ? '⏳ Verification Pending'
                                                        : '⚠️ Setup Required')}
                                            </h3>
                                            <p className="text-white/60 text-sm">
                                                {settings.stripe_account_status === 'complete'
                                                    ? 'Your account is ready to receive payouts.'
                                                    : 'Complete the onboarding to start receiving funds.'}
                                            </p>
                                        </div>

                                        {(!settings.stripe_account_status || settings.stripe_account_status === 'pending' || settings.stripe_account_status === 'restricted') && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const res = await api.connectOnboarding();
                                                        if (res.url) window.location.href = res.url;
                                                    } catch (err) {
                                                        alert('Failed to start onboarding');
                                                    }
                                                }}
                                                className="bg-[#635BFF] hover:bg-[#5851E0] text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
                                            >
                                                <span>Connect with Stripe</span>
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Manual Banking Info (Fallback/Legacy) */}
                                {(!settings.stripe_account_id) && (
                                    <div className="opacity-50 pointer-events-none filter blur-[1px]">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="h-px bg-white/10 flex-1"></div>
                                            <span className="text-white/40 text-xs uppercase tracking-wider">Legacy Settings</span>
                                            <div className="h-px bg-white/10 flex-1"></div>
                                        </div>
                                        <div className="space-y-4 max-w-2xl">
                                            <div>
                                                <label className="block text-white/70 text-sm mb-2">Account Holder Name</label>
                                                <input disabled type="text" className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2 text-white/50" value="Managed by Stripe" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-primary hover:bg-accent text-white px-8 py-3 rounded-lg transition-colors font-medium disabled:opacity-50 text-lg"
                        >
                            {saving ? 'Saving...' : '💾 Save Settings'}
                        </button>
                    </div>
                </div>
            </div>
        </OwnerLayout>
    );
};
