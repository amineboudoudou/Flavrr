
import React, { useState, useMemo } from 'react';
import { CartItem, Language } from '../types';
import { X, ChevronRight, ChevronLeft, MapPin, Truck, CreditCard, Receipt, CheckCircle } from './Icons';

interface Props {
    lang: Language;
    isOpen: boolean;
    onClose: () => void;
    items: CartItem[];
    cartTotal: number;
    onSuccess: () => void;
}

type CheckoutStep = 'ITEMS' | 'DETAILS' | 'DELIVERY' | 'PAYMENT' | 'SUCCESS';

export const CheckoutFlow: React.FC<Props> = ({ lang, isOpen, onClose, items, cartTotal, onSuccess }) => {
    const [step, setStep] = useState<CheckoutStep>('ITEMS');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        street: '',
        city: 'Montréal',
        postal: '',
        instructions: ''
    });

    const deliveryFee = 5.99; // Mock fee
    const taxRate = 0.14975; // Québec tax rate
    const tax = cartTotal * taxRate;
    const total = cartTotal + tax + deliveryFee;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const isDetailsValid = useMemo(() => {
        return formData.name && formData.email.includes('@') && formData.phone.length >= 10 && formData.street && formData.postal.length >= 6;
    }, [formData]);

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
                                {step === 'ITEMS' && (lang === 'fr' ? 'Récapitulatif' : 'Review Items')}
                                {step === 'DETAILS' && (lang === 'fr' ? 'Coordonnées' : 'Customer Details')}
                                {step === 'DELIVERY' && (lang === 'fr' ? 'Livraison' : 'Delivery Selection')}
                                {step === 'PAYMENT' && (lang === 'fr' ? 'Paiement' : 'Payment')}
                                {step === 'SUCCESS' && (lang === 'fr' ? 'Confirmé' : 'Confirmed')}
                            </h2>
                            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">
                                {step !== 'SUCCESS' && `Step ${['ITEMS', 'DETAILS', 'DELIVERY', 'PAYMENT'].indexOf(step) + 1} of 4`}
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
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-[10px] text-white/40 uppercase tracking-widest font-black">Adresse de livraison</label>
                                <input
                                    type="text" name="street" value={formData.street} onChange={handleInputChange}
                                    placeholder="123 rue Sherbrooke"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:border-pink-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] text-white/40 uppercase tracking-widest font-black">Code Postal</label>
                                <input
                                    type="text" name="postal" value={formData.postal} onChange={handleInputChange}
                                    placeholder="H2X 1Y4"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:border-pink-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] text-white/40 uppercase tracking-widest font-black">Ville</label>
                                <input
                                    type="text" value="Montréal" disabled
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/40 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    )}

                    {step === 'DELIVERY' && (
                        <div className="space-y-6">
                            <div className="bg-pink-600/10 border border-pink-500/20 p-6 rounded-2xl flex items-center gap-6">
                                <div className="w-16 h-16 bg-pink-600 rounded-full flex items-center justify-center text-white">
                                    <Truck className="w-8 h-8" />
                                </div>
                                <div>
                                    <h4 className="text-white font-serif text-xl">Livraison Standard</h4>
                                    <p className="text-white/40 text-sm">Temps estimé: 35-45 mins</p>
                                </div>
                                <div className="ml-auto text-2xl font-serif text-white">${deliveryFee}</div>
                            </div>
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                <label className="text-[10px] text-white/40 uppercase tracking-widest font-black block mb-3">Instructions pour le livreur</label>
                                <textarea
                                    name="instructions" value={formData.instructions} onChange={handleInputChange}
                                    placeholder="Code de porte, instructions spéciales..."
                                    className="w-full bg-transparent border-none text-white resize-none h-24 focus:ring-0 placeholder:text-white/10"
                                />
                            </div>
                        </div>
                    )}

                    {step === 'PAYMENT' && (
                        <div className="space-y-8">
                            <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 text-center space-y-4">
                                <div className="w-20 h-20 bg-pink-600/20 rounded-full flex items-center justify-center text-pink-500 mx-auto">
                                    <CreditCard className="w-10 h-10" />
                                </div>
                                <h3 className="text-white font-serif text-2xl">Préparation du paiement sécurisé</h3>
                                <p className="text-white/40 text-sm max-w-xs mx-auto">Vous allez être redirigé vers Stripe pour finaliser votre commande en toute sécurité.</p>
                                <div className="pt-4 flex justify-center gap-4 grayscale opacity-40">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" className="h-8" />
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-6" />
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-8" />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'SUCCESS' && (
                        <div className="text-center py-12 space-y-6">
                            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto animate-bounce shadow-2xl shadow-green-500/20">
                                <CheckCircle className="w-12 h-12" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-4xl font-serif text-white">Commande Reçue !</h2>
                                <p className="text-white/40">Merci {formData.name}, votre festin est en route.</p>
                            </div>
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 max-w-sm mx-auto text-left space-y-2">
                                <p className="text-[10px] text-white/40 uppercase font-black">Numéro de Commande</p>
                                <p className="text-white font-mono text-lg text-pink-500">#{Math.floor(1000 + Math.random() * 9000)}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-10 py-4 bg-white text-black font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-200 transition-all"
                            >
                                Retour au Menu
                            </button>
                        </div>
                    )}

                </div>

                {/* Footer Toggle */}
                {step !== 'SUCCESS' && (
                    <div className="p-8 border-t border-white/5 bg-black/40 backdrop-blur-3xl space-y-4">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-[10px] text-white/20 uppercase tracking-widest">Total de la commande</p>
                                <div className="flex items-center gap-4">
                                    <span className="text-4xl font-serif text-white">${total.toFixed(2)}</span>
                                    <span className="text-[10px] text-white/40 uppercase tracking-tighter">Taxes & Livraison incl.</span>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                {step !== 'ITEMS' && (
                                    <button
                                        onClick={() => {
                                            if (step === 'DETAILS') setStep('ITEMS');
                                            if (step === 'DELIVERY') setStep('DETAILS');
                                            if (step === 'PAYMENT') setStep('DELIVERY');
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
                                {step === 'DELIVERY' && (
                                    <button
                                        onClick={() => setStep('PAYMENT')}
                                        className="group flex items-center gap-4 px-10 py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-pink-600 hover:text-white transition-all shadow-2xl"
                                    >
                                        Paiement <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                )}
                                {step === 'PAYMENT' && (
                                    <button
                                        onClick={() => {
                                            onSuccess();
                                            setStep('SUCCESS');
                                        }}
                                        className="group flex items-center gap-4 px-10 py-4 bg-pink-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-pink-500 transition-all shadow-2xl animate-pulse"
                                    >
                                        Payer Maintenant <CreditCard className="w-5 h-5 ml-2" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>

            <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-scale-in { animation: scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
        </div>
    );
};
