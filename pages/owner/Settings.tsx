import React, { useState } from 'react';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { Toast } from '../../components/Toast';

export const Settings: React.FC = () => {
    // Mock settings state - in real app, would fetch from DB
    const [restaurantName] = useState('Café Du Griot');
    const [isOpen, setIsOpen] = useState(true);
    const [defaultPrepTime, setDefaultPrepTime] = useState(20);
    const [taxRate, setTaxRate] = useState(14.975);
    const [tipsEnabled, setTipsEnabled] = useState(true);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const pickupAddress = {
        street: '1234 Rue Saint-Laurent',
        city: 'Montréal',
        province: 'QC',
        postalCode: 'H2X 2T3',
    };

    const handleSave = () => {
        // In real app, would save to database
        setToastMessage('Settings saved successfully!');
    };

    const handleTestNotification = () => {
        setToastMessage('🔔 Test notification!');
        // Could also play sound here
    };

    return (
        <OwnerLayout>
            <div className="p-4 md:p-6 max-w-3xl mx-auto">
                <h1 className="text-white text-2xl font-bold mb-6">Settings</h1>

                <div className="space-y-6">
                    {/* Restaurant Info */}
                    <div className="bg-neutral-800 border border-white/10 rounded-xl p-6">
                        <h2 className="text-white font-semibold text-lg mb-4">Restaurant Information</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-white/70 text-sm mb-2">Restaurant Name</label>
                                <input
                                    type="text"
                                    value={restaurantName}
                                    disabled
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white/50 cursor-not-allowed"
                                />
                                <p className="text-white/40 text-xs mt-1">Contact support to change restaurant name</p>
                            </div>

                            <div>
                                <label className="block text-white/70 text-sm mb-2">Pickup Address</label>
                                <div className="bg-black/40 border border-white/10 rounded-lg p-4 text-white/70 text-sm">
                                    <p>{pickupAddress.street}</p>
                                    <p>{pickupAddress.city}, {pickupAddress.province} {pickupAddress.postalCode}</p>
                                </div>
                                <p className="text-white/40 text-xs mt-1">Contact support to update address</p>
                            </div>
                        </div>
                    </div>

                    {/* Operations */}
                    <div className="bg-neutral-800 border border-white/10 rounded-xl p-6">
                        <h2 className="text-white font-semibold text-lg mb-4">Operations</h2>

                        <div className="space-y-4">
                            {/* Open/Closed Toggle */}
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <p className="text-white font-medium">Restaurant Status</p>
                                    <p className="text-white/60 text-sm">Accept new orders</p>
                                </div>
                                <button
                                    onClick={() => setIsOpen(!isOpen)}
                                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${isOpen ? 'bg-green-500' : 'bg-red-500'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isOpen ? 'translate-x-7' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>

                            {/* Prep Time */}
                            <div>
                                <label className="block text-white/70 text-sm mb-2">Default Prep Time (minutes)</label>
                                <input
                                    type="number"
                                    value={defaultPrepTime}
                                    onChange={(e) => setDefaultPrepTime(Number(e.target.value))}
                                    min="5"
                                    max="120"
                                    className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>

                            {/* Tax Rate */}
                            <div>
                                <label className="block text-white/70 text-sm mb-2">Tax Rate (%)</label>
                                <input
                                    type="number"
                                    value={taxRate}
                                    onChange={(e) => setTaxRate(Number(e.target.value))}
                                    min="0"
                                    max="30"
                                    step="0.001"
                                    className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>

                            {/* Tips Enabled */}
                            <div className="flex items-center justify-between py-2">
                                <div>
                                    <p className="text-white font-medium">Enable Tips</p>
                                    <p className="text-white/60 text-sm">Allow customers to add tips</p>
                                </div>
                                <button
                                    onClick={() => setTipsEnabled(!tipsEnabled)}
                                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${tipsEnabled ? 'bg-primary' : 'bg-neutral-600'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${tipsEnabled ? 'translate-x-7' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Notifications */}
                    <div className="bg-neutral-800 border border-white/10 rounded-xl p-6">
                        <h2 className="text-white font-semibold text-lg mb-4">Notifications</h2>

                        <button
                            onClick={handleTestNotification}
                            className="w-full bg-neutral-700 hover:bg-neutral-600 text-white font-medium py-3 rounded-lg transition-colors"
                        >
                            🔔 Test Notification
                        </button>
                        <p className="text-white/40 text-xs mt-2">
                            Use this to test sound and notification settings
                        </p>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        className="w-full bg-primary hover:bg-accent text-white font-semibold py-4 rounded-lg transition-colors text-lg"
                    >
                        💾 Save Settings
                    </button>
                </div>
            </div>

            {toastMessage && (
                <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
            )}
        </OwnerLayout>
    );
};
