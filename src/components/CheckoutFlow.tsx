import React, { useState, useMemo, useEffect } from 'react';
import { CartItem, Language, OrganizationProfile, FulfillmentType, CheckoutStep } from '../types';
import { X, ChevronRight, ChevronLeft, MapPin, Truck, CreditCard, Receipt, CheckCircle, Clock } from './Icons';
import { UI_STRINGS } from '../constants';
import * as api from '../lib/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe outside component
// NOTE: Ideally this comes from an env var, using a hardcoded placeholder or fetching config is common.
// Assuming we use the public key from env or similar.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_...');

interface Props {
    lang: Language;
    isOpen: boolean;
    onClose: () => void;
    items: CartItem[];
    cartTotal: number;
    organization: OrganizationProfile | null;
    workspaceSlug: string;
    onSuccess: () => void;
    initialStep?: CheckoutStep;
    initialToken?: string;
}

import { AddressAutocomplete } from './AddressAutocomplete';

const PaymentForm = ({
    lang,
    total,
    onSuccess,
    onError
}: {
    lang: Language;
    total: number;
    onSuccess: (paymentIntentId: string) => void;
    onError: (msg: string) => void;
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsProcessing(true);
        setErrorMessage(null);

        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                redirect: 'if_required', // Avoid redirect if possible
                confirmParams: {
                    return_url: window.location.origin + '/?success=true', // Fallback
                },
            });

            if (error) {
                setErrorMessage(error.message || 'Payment failed');
                onError(error.message || 'Payment failed');
            } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                onSuccess(paymentIntent.id);
            } else {
                // Unexpected state
                setErrorMessage('Unexpected payment status: ' + (paymentIntent?.status));
            }
        } catch (err: any) {
            setErrorMessage(err.message);
            onError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <PaymentElement
                    options={{
                        layout: 'tabs',
                        paymentMethodOrder: ['card', 'apple_pay', 'google_pay'],
                    }}
                />
            </div>

            {errorMessage && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    {errorMessage}
                </div>
            )}

            <button
                type="submit"
                disabled={!stripe || isProcessing}
                className="w-full group flex items-center justify-center gap-4 px-10 py-4 bg-pink-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-pink-500 transition-all shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isProcessing ? 'Processing...' : (lang === 'fr' ? `Payer $${total.toFixed(2)}` : `Pay $${total.toFixed(2)}`)}
                {!isProcessing && <CheckCircle className="w-5 h-5 ml-2" />}
            </button>
        </form>
    );
};

export const CheckoutFlow: React.FC<Props> = ({ lang, isOpen, onClose, items, cartTotal, organization, workspaceSlug, onSuccess, initialStep = 'ITEMS', initialToken = '' }) => {
    const [step, setStep] = useState<CheckoutStep>(initialStep || 'ITEMS');
    const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('pickup');
    const [selectedSlot, setSelectedSlot] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderToken, setOrderToken] = useState<string>(initialToken);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [orderNumber, setOrderNumber] = useState<number | null>(null);

    // Reset state when opening/closing
    useEffect(() => {
        if (!isOpen) {
            setClientSecret(null);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        street: '',
        city: 'Montréal',
        postal: '',
        region: 'QC',
        country: 'CA',
        lat: 0,
        lng: 0,
        instructions: '',
        marketing_opt_in: false
    });

    const handleAddressSelect = (address: any) => {
        setFormData(prev => ({
            ...prev,
            street: address.street,
            city: address.city,
            postal: address.postal_code,
            region: address.region,
            country: address.country,
            lat: address.lat,
            lng: address.lng
        }));
    };

    const deliveryFee = fulfillmentType === 'delivery' ? 5.99 : 0;
    const taxRate = organization?.settings?.tax_rate ? organization.settings.tax_rate / 100 : 0.14975;
    const tax = cartTotal * taxRate;
    const total = cartTotal + tax + deliveryFee;

    const generateSlots = useMemo(() => {
        if (!organization || !organization.business_hours) return [];

        const slots: { label: string; value: string }[] = [];
        const now = new Date();
        const prepBuffer = organization.settings.default_prep_time_minutes || 30;
        const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';

        // Look ahead up to 7 days (including today)
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const date = new Date(now);
            date.setDate(now.getDate() + dayOffset);

            const dayOfWeek = date.getDay();
            const hours = organization.business_hours.find(h => h.day_of_week === dayOfWeek);
            if (!hours || hours.is_closed) continue;

            const [openHour, openMin] = hours.open_time.split(':').map(Number);
            const [closeHour, closeMin] = hours.close_time.split(':').map(Number);

            const openTimeDate = new Date(date);
            openTimeDate.setHours(openHour, openMin, 0, 0);

            const closeTimeDate = new Date(date);
            closeTimeDate.setHours(closeHour, closeMin, 0, 0);

            // Earliest start respects prep buffer when dayOffset is 0 (today)
            const earliestPossible = dayOffset === 0
                ? new Date(now.getTime() + prepBuffer * 60000)
                : openTimeDate;

            let startTime = earliestPossible > openTimeDate ? earliestPossible : openTimeDate;

            // Round up to next 1-hour interval
            const minutes = startTime.getMinutes();
            if (minutes > 0) {
                startTime = new Date(startTime.getTime() + (60 - minutes) * 60000);
            }
            startTime.setSeconds(0, 0);

            while (startTime < closeTimeDate) {
                const dayLabel = startTime.toLocaleDateString(locale, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                });
                const timeStr = startTime.toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                slots.push({ label: `${dayLabel} · ${timeStr}`, value: startTime.toISOString() });
                startTime = new Date(startTime.getTime() + 60 * 60000);
            }

            // Stop early if we already have future slots
            if (slots.length > 0) break;
        }

        return slots;
    }, [organization, lang]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const isDetailsValid = useMemo(() => {
        const baseValid = formData.name && formData.email.includes('@') && formData.phone.length >= 10;
        if (fulfillmentType === 'delivery') {
            return baseValid && formData.street && formData.postal.length >= 6;
        }
        return baseValid;
    }, [formData, fulfillmentType]);

    // Initialize Payment Intent when reaching Payment step
    useEffect(() => {
        if (step === 'PAYMENT' && !clientSecret && !isSubmitting) {
            const initPayment = async () => {
                setIsSubmitting(true);
                try {
                    // Stable idempotency key per checkout attempt
                    const storageKey = 'flavrr_checkout_idempotency_key';
                    let idempotencyKey = localStorage.getItem(storageKey);
                    if (!idempotencyKey) {
                        idempotencyKey = `checkout_${crypto.randomUUID()}`;
                        localStorage.setItem(storageKey, idempotencyKey);
                    }
                    
                    const res = await api.publicCreatePaymentIntent({
                        workspace_slug: workspaceSlug,
                        idempotency_key: idempotencyKey,
                        currency: 'cad',
                        items: items.map(i => ({
                            product_id: i.id,
                            name: i.name[lang],
                            unit_price_cents: Math.round(i.price * 100),
                            qty: i.quantity
                        })),
                        customer: {
                            name: formData.name,
                            email: formData.email,
                            phone: formData.phone,
                        },
                        fulfillment: {
                            type: fulfillmentType,
                            dropoff_address: fulfillmentType === 'delivery' ? `${formData.street}, ${formData.city}, ${formData.region} ${formData.postal}, ${formData.country}` : undefined,
                            dropoff_lat: fulfillmentType === 'delivery' ? formData.lat : undefined,
                            dropoff_lng: fulfillmentType === 'delivery' ? formData.lng : undefined,
                            notes: formData.instructions
                        },
                        totals: {
                            subtotal_cents: Math.round(cartTotal * 100),
                            delivery_fee_cents: Math.round(deliveryFee * 100),
                            service_fee_cents: 0,
                            tax_cents: Math.round(tax * 100),
                            total_cents: Math.round(total * 100),
                        }
                    });

                    if (res.client_secret) {
                        setClientSecret(res.client_secret);
                        setOrderToken(res.order_id);
                        if (res.order_number) {
                            setOrderNumber(res.order_number);
                        }
                    }
                } catch (err: any) {
                    console.error('Failed to init payment', err);
                    
                    // Show specific error messages based on error code
                    let errorMessage = lang === 'fr' 
                        ? 'Impossible d\'initialiser le paiement. Veuillez réessayer.'
                        : 'Could not initialize payment. Please try again.';
                    
                    if (err.code === 'INVALID_EMAIL') {
                        errorMessage = lang === 'fr' 
                            ? 'Adresse courriel invalide. Veuillez vérifier.'
                            : 'Invalid email address. Please check.';
                    } else if (err.code === 'ITEMS_UNAVAILABLE') {
                        errorMessage = lang === 'fr'
                            ? 'Certains articles ne sont plus disponibles.'
                            : 'Some items are no longer available.';
                    } else if (err.code === 'ORG_NOT_FOUND') {
                        errorMessage = lang === 'fr'
                            ? 'Restaurant introuvable. Veuillez rafraîchir la page.'
                            : 'Restaurant not found. Please refresh the page.';
                    } else if (err.status === 429) {
                        errorMessage = lang === 'fr'
                            ? 'Trop de tentatives. Veuillez patienter un moment.'
                            : 'Too many attempts. Please wait a moment.';
                    } else if (err.status >= 500) {
                        errorMessage = lang === 'fr'
                            ? 'Erreur serveur. Veuillez réessayer dans quelques instants.'
                            : 'Server error. Please try again in a few moments.';
                    }
                    
                    alert(errorMessage + (err.requestId ? `\n\nID: ${err.requestId}` : ''));
                } finally {
                    setIsSubmitting(false);
                }
            };
            initPayment();
        }
    }, [step, clientSecret, items, formData, fulfillmentType, isSubmitting, lang]);


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/90 backdrop-blur-xl animate-fade-in"
                onClick={step === 'SUCCESS' ? onClose : undefined}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col animate-scale-in max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-pink-600/20 rounded-full flex items-center justify-center text-pink-500">
                            {step === 'ITEMS' && <Receipt className="w-5 h-5" />}
                            {step === 'DETAILS' && <MapPin className="w-5 h-5" />}
                            {step === 'DELIVERY' && <Truck className="w-5 h-5" />}
                            {step === 'PAYMENT' && <CreditCard className="w-5 h-5" />}
                            {step === 'SUCCESS' && <CheckCircle className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-serif text-white uppercase tracking-wider">
                                {step === 'ITEMS' && UI_STRINGS.reviewItems[lang]}
                                {step === 'DETAILS' && UI_STRINGS.customerDetails[lang]}
                                {step === 'DELIVERY' && (lang === 'fr' ? 'Livraison' : 'Delivery Selection')}
                                {step === 'PAYMENT' && UI_STRINGS.paymentTitle[lang]}
                                {step === 'SUCCESS' && UI_STRINGS.confirmTitle[lang]}
                            </h2>
                            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">
                                {step !== 'SUCCESS' && `${UI_STRINGS.stepOf[lang]} ${['ITEMS', 'DETAILS', 'DELIVERY', 'PAYMENT'].indexOf(step) + 1} of 4`}
                            </p>
                        </div>
                    </div>
                    {step !== 'SUCCESS' && (
                        <button onClick={onClose} className="p-2 text-white/40 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">

                    {step === 'ITEMS' && (
                        <div className="space-y-4">
                            {items.map(item => (
                                <div key={item.id} className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-4">
                                        <span className="text-pink-500 font-bold bg-pink-500/10 w-8 h-8 rounded flex items-center justify-center">{item.quantity}x</span>
                                        <span className="text-white font-medium">{item.name[lang]}</span>
                                    </div>
                                    <span className="text-white/60 font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {step === 'DETAILS' && (
                        <div className="space-y-6">
                            {/* Fulfillment Selector */}
                            <div className="flex gap-4 p-1 bg-white/5 rounded-2xl border border-white/5">
                                {(organization?.settings?.fulfillment_types || ['pickup', 'delivery']).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setFulfillmentType(type)}
                                        className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl transition-all ${fulfillmentType === type
                                            ? 'bg-white text-black font-bold shadow-xl'
                                            : 'text-white/40 hover:text-white'
                                            }`}
                                    >
                                        {type === 'delivery' ? <Truck className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                                        <span className="uppercase tracking-widest text-xs">
                                            {type === 'delivery' ? UI_STRINGS.fulfillmentDelivery[lang] : UI_STRINGS.fulfillmentPickup[lang]}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[10px] text-white/40 uppercase tracking-widest font-black">Nom Complet</label>
                                    <input
                                        type="text" name="name" value={formData.name} onChange={handleInputChange}
                                        placeholder="Jean Dupont"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:border-pink-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-white/40 uppercase tracking-widest font-black">Email</label>
                                    <input
                                        type="email" name="email" value={formData.email} onChange={handleInputChange}
                                        placeholder="jean@example.com"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:border-pink-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-white/40 uppercase tracking-widest font-black">Téléphone</label>
                                    <input
                                        type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                                        placeholder="514-000-0000"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:border-pink-500 outline-none transition-all"
                                    />
                                </div>

                                <div className="md:col-span-2 space-y-3">
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            name="marketing_opt_in"
                                            checked={formData.marketing_opt_in}
                                            onChange={handleInputChange}
                                            className="mt-1 w-5 h-5 rounded border-2 border-white/20 bg-white/5 text-pink-600 focus:ring-2 focus:ring-pink-500 focus:ring-offset-0 cursor-pointer transition-all"
                                        />
                                        <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
                                            {lang === 'fr' 
                                                ? "J'accepte de recevoir des offres et des mises à jour par courriel" 
                                                : "I agree to receive offers & updates by email"}
                                        </span>
                                    </label>
                                </div>

                                {fulfillmentType === 'delivery' && (
                                    <>
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-[10px] text-white/40 uppercase tracking-widest font-black">Adresse de livraison (Auto-completion)</label>
                                            <AddressAutocomplete
                                                onAddressSelect={handleAddressSelect}
                                                placeholder="Commencez à taper votre adresse..."
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:border-pink-500 outline-none transition-all"
                                                restrictCountries={['CA']}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-white/40 uppercase tracking-widest font-black">Rue (Sélectionnée)</label>
                                            <input
                                                type="text" value={formData.street} readOnly
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/40 cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-white/40 uppercase tracking-widest font-black">Code Postal</label>
                                            <input
                                                type="text" value={formData.postal} readOnly
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/40 cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-white/40 uppercase tracking-widest font-black">Ville</label>
                                            <input
                                                type="text" value={formData.city} readOnly
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/40 cursor-not-allowed"
                                            />
                                        </div>
                                    </>
                                )}

                                {fulfillmentType === 'pickup' && organization && (
                                    <div className="md:col-span-2 p-6 bg-pink-600/5 border border-pink-500/20 rounded-2xl flex items-start gap-4">
                                        <MapPin className="w-6 h-6 text-pink-500 mt-1" />
                                        <div>
                                            <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-1">
                                                {UI_STRINGS.pickupAddress[lang]}
                                            </h4>
                                            <p className="text-white/70 text-sm">
                                                {organization.name}<br />
                                                {organization.street}, {organization.city}<br />
                                                {organization.postal_code}, {organization.region}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'DELIVERY' && (
                        <div className="space-y-8">
                            {/* Fulfillment Summary */}
                            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex items-center gap-6">
                                <div className="w-16 h-16 bg-pink-600 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg shadow-pink-600/20">
                                    {fulfillmentType === 'delivery' ? <Truck className="w-8 h-8" /> : <MapPin className="w-8 h-8" />}
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-white font-serif text-xl">
                                        {fulfillmentType === 'delivery' ? UI_STRINGS.fulfillmentDelivery[lang] : UI_STRINGS.fulfillmentPickup[lang]}
                                    </h4>
                                    <p className="text-white/40 text-sm">
                                        {fulfillmentType === 'delivery' ? `${formData.street}, ${formData.postal}` : organization?.street}
                                    </p>
                                </div>
                                {fulfillmentType === 'delivery' && (
                                    <div className="text-2xl font-serif text-white">${deliveryFee.toFixed(2)}</div>
                                )}
                            </div>

                            {/* Slot Selector */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <Clock className="w-4 h-4 text-pink-500" />
                                    <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black">
                                        {UI_STRINGS.chooseTime[lang]}
                                    </label>
                                </div>

                                {generateSlots.length > 0 ? (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                        {generateSlots.map(slot => (
                                            <button
                                                key={slot.value}
                                                onClick={() => setSelectedSlot(slot.value)}
                                                className={`py-3 rounded-xl text-sm font-medium transition-all ${selectedSlot === slot.value
                                                    ? 'bg-pink-600 text-white border-pink-500 shadow-lg shadow-pink-600/20'
                                                    : 'bg-white/5 text-white/60 border border-white/5 hover:border-white/20 hover:text-white'
                                                    }`}
                                            >
                                                {slot.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center bg-red-500/10 border border-red-500/20 rounded-2xl">
                                        <p className="text-red-400 font-medium">
                                            {UI_STRINGS.closedMessage[lang]}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Instructions */}
                            <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                                <label className="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-3">
                                    {UI_STRINGS.specialInstructions[lang]}
                                </label>
                                <textarea
                                    name="instructions" value={formData.instructions} onChange={handleInputChange}
                                    placeholder={UI_STRINGS.instructionsPlaceholder[lang]}
                                    className="w-full bg-transparent border-none text-white resize-none h-20 focus:ring-0 placeholder:text-white/10 text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {step === 'PAYMENT' && (
                        <div className="space-y-8">
                            {/* Order Summary */}
                            <div className="mb-6 bg-white/5 p-4 rounded-xl border border-white/5">
                                <div className="flex justify-between text-white/80 text-sm mb-1">
                                    <span>Subtotal</span>
                                    <span>${cartTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-white/80 text-sm mb-1">
                                    <span>Tax ({((taxRate) * 100).toFixed(1)}%)</span>
                                    <span>${tax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-white/80 text-sm mb-3">
                                    <span>Delivery</span>
                                    <span>${deliveryFee.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-white font-bold text-lg border-t border-white/10 pt-2">
                                    <span>Total</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>
                            </div>

                            {isSubmitting ? (
                                <div className="py-12 flex flex-col items-center justify-center space-y-4">
                                    <div className="w-10 h-10 border-4 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-white/60 font-medium animate-pulse">Initializing Secure Payment...</p>
                                </div>
                            ) : clientSecret ? (
                                <Elements stripe={stripePromise} options={{
                                    clientSecret,
                                    appearance: {
                                        theme: 'night',
                                        variables: {
                                            colorPrimary: '#ec4899',
                                            colorBackground: '#1a1a1a',
                                            colorText: '#ffffff',
                                        }
                                    }
                                }}>
                                    <PaymentForm
                                        lang={lang}
                                        total={total}
                                        onSuccess={(paymentIntentId) => {
                                            console.log('Payment Succeeded!', paymentIntentId);
                                            setStep('SUCCESS');
                                            onSuccess();
                                        }}
                                        onError={(msg) => alert(msg)}
                                    />
                                </Elements>
                            ) : (
                                <div className="py-8 text-center text-red-400">
                                    Failed to load payment configuration. Please try again.
                                    <button
                                        onClick={() => setStep('DELIVERY')}
                                        className="block mx-auto mt-4 text-white underline"
                                    >
                                        Go Back
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'SUCCESS' && (
                        <div className="text-center py-12 space-y-6">
                            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto animate-bounce shadow-2xl shadow-green-500/20">
                                <CheckCircle className="w-12 h-12" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-4xl font-serif text-white">{UI_STRINGS.orderReceived[lang]}</h2>
                                <p className="text-white/40">{UI_STRINGS.orderThanks[lang].replace('{name}', formData.name)}</p>
                            </div>
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 max-w-sm mx-auto text-left space-y-2">
                                <p className="text-[10px] text-white/40 uppercase font-black">{UI_STRINGS.orderNumber[lang]}</p>
                                <p className="text-white font-mono text-lg text-pink-500">#{orderNumber || orderToken || 'Processing...'}</p>
                            </div>

                            {/* Track Order Button - for all orders */}
                            <a
                                href={`/t/${orderToken}`}
                                className="block max-w-sm mx-auto w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-600/20"
                            >
                                📍 {lang === 'fr' ? 'Suivre ma commande' : 'Track My Order'}
                            </a>

                            {/* Pickup Address with Maps Link - for pickup orders */}
                            {fulfillmentType === 'pickup' && organization && (
                                <div className="max-w-sm mx-auto">
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${organization.name} ${organization.street} ${organization.city} ${organization.postal_code}`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-full p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all text-left"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-pink-600/20 rounded-full flex items-center justify-center shrink-0">
                                                <MapPin className="w-6 h-6 text-pink-500" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white/60 text-xs uppercase tracking-wider mb-1">
                                                    {lang === 'fr' ? 'Adresse de retrait' : 'Pickup Location'}
                                                </p>
                                                <p className="text-white font-medium">
                                                    {organization.name}
                                                </p>
                                                <p className="text-white/70 text-sm">
                                                    {organization.street}<br />
                                                    {organization.city}, {organization.postal_code}
                                                </p>
                                                <p className="text-pink-400 text-xs mt-3 flex items-center gap-1">
                                                    <span>🗺️</span>
                                                    {lang === 'fr' ? 'Ouvrir dans Google Maps' : 'Open in Google Maps'}
                                                    <span>→</span>
                                                </p>
                                            </div>
                                        </div>
                                    </a>
                                </div>
                            )}

                            <button
                                onClick={onClose}
                                className="px-10 py-4 bg-white text-black font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-200 transition-all"
                            >
                                {UI_STRINGS.backToMenu[lang]}
                            </button>
                        </div>
                    )}

                </div>

                {/* Footer Toggle (Hidden on Payment Step because PaymentForm has its own button) */}
                {step !== 'SUCCESS' && step !== 'PAYMENT' && (
                    <div className="p-8 border-t border-white/5 bg-black/40 backdrop-blur-3xl space-y-4">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-[10px] text-white/20 uppercase tracking-widest">{UI_STRINGS.orderTotal[lang]}</p>
                                <div className="flex items-center gap-4">
                                    <span className="text-4xl font-serif text-white">${total.toFixed(2)}</span>
                                    <span className="text-[10px] text-white/40 uppercase tracking-tighter">{UI_STRINGS.taxesIncluded[lang]}</span>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                {step !== 'ITEMS' && (
                                    <button
                                        onClick={() => {
                                            if (step === 'DETAILS') setStep('ITEMS');
                                            if (step === 'DELIVERY') setStep('DETAILS');
                                        }}
                                        className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white hover:text-black transition-all"
                                    >
                                        <ChevronLeft className="w-6 h-6" />
                                    </button>
                                )}
                                {step === 'ITEMS' && (
                                    <button
                                        onClick={() => setStep('DETAILS')}
                                        className="group flex items-center gap-4 px-10 py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-pink-600 hover:text-white transition-all shadow-2xl"
                                    >
                                        Continuer <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                )}
                                {step === 'DETAILS' && (
                                    <button
                                        disabled={!isDetailsValid}
                                        onClick={() => setStep('DELIVERY')}
                                        className={`group flex items-center gap-4 px-10 py-4 font-black uppercase tracking-widest rounded-2xl transition-all shadow-2xl ${isDetailsValid ? 'bg-white text-black hover:bg-pink-600 hover:text-white' : 'bg-white/10 text-white/20 cursor-not-allowed'
                                            }`}
                                    >
                                        Livraison <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                )}
                                {(step as string) === 'DELIVERY' && (
                                    <button
                                        disabled={!selectedSlot}
                                        onClick={() => setStep('PAYMENT')}
                                        className={`group flex items-center gap-4 px-10 py-4 font-black uppercase tracking-widest rounded-2xl transition-all shadow-2xl ${selectedSlot ? 'bg-white text-black hover:bg-pink-600 hover:text-white' : 'bg-white/10 text-white/20 cursor-not-allowed'
                                            }`}
                                    >
                                        Paiement <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Back button for Payment step specifically */}
                {step === 'PAYMENT' && (
                    <div className="p-8 border-t border-white/5 bg-black/40 backdrop-blur-3xl space-y-4">
                        <div className="flex justify-between items-end">
                            <button
                                onClick={() => setStep('DELIVERY')}
                                className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white hover:text-black transition-all"
                            >
                                <ChevronLeft className="w-6 h-6" /> <span className="ml-2 font-bold uppercase text-xs tracking-widest">Back</span>
                            </button>
                        </div>
                    </div>
                )}

            </div>

            <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-scale-in { animation: scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
        </div >
    );
};
