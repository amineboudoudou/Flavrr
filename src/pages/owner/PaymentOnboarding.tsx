import React, { useEffect, useState } from 'react';
import { OwnerLayout } from '../../components/owner/OwnerLayout';
import { BrandedLoader } from '../../components/owner/BrandedLoader';
import { TrustCard } from '../../components/owner/TrustCard';
import { StepItem } from '../../components/owner/StepItem';
import { FAQItem } from '../../components/owner/FAQItem';
import { api } from '../../lib/api';

interface PaymentOnboardingProps {
  stripeAccountStatus?: string;
  onConnect: () => Promise<void>;
}

export const PaymentOnboarding: React.FC<PaymentOnboardingProps> = ({ 
  stripeAccountStatus, 
  onConnect 
}) => {
  const [loading, setLoading] = useState(false);

  const isConnected = stripeAccountStatus === 'complete' || stripeAccountStatus === 'details_submitted';

  const handleConnect = async () => {
    setLoading(true);
    try {
      await onConnect();
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isConnected) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Success State */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-white text-2xl font-bold mb-2">You&apos;re all set!</h2>
          <p className="text-white/70 text-base">
            {stripeAccountStatus === 'complete' 
              ? 'Your account is ready to receive payouts.'
              : 'Your account is being verified. You&apos;ll be able to receive payouts soon.'}
          </p>
        </div>

        {/* What's Next */}
        <div className="bg-neutral-800 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold text-lg mb-4">What happens next?</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-white/80">Customers can place orders and pay through your storefront</p>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-white/80">Funds are automatically transferred to your bank account</p>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-white/80">Track all transactions in your Stripe dashboard</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-white text-3xl md:text-4xl font-bold">Get paid automatically</h1>
        <p className="text-white/60 text-lg">Connect where you want to receive money from orders</p>
      </div>

      {/* Trust Card */}
      <TrustCard 
        items={[
          'Payments go directly to your bank',
          'Flavrr never holds your funds',
          'Secure infrastructure trusted by modern marketplaces'
        ]}
      />

      {/* How it Works */}
      <div className="bg-neutral-800 border border-white/10 rounded-2xl p-8">
        <h2 className="text-white text-xl font-semibold mb-6 text-center">How it works</h2>
        <div className="space-y-6">
          <StepItem 
            number={1}
            title="Enter your business details"
          />
          <StepItem 
            number={2}
            title="Add your bank account"
          />
          <StepItem 
            number={3}
            title="Start receiving payouts automatically"
          />
        </div>
      </div>

      {/* CTA Button */}
      <div className="text-center space-y-3">
        <button
          onClick={handleConnect}
          disabled={loading}
          className="bg-gradient-to-r from-primary to-accent hover:from-accent hover:to-primary text-white px-10 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 shadow-lg"
        >
          {loading ? 'Connecting...' : 'Connect payouts'}
        </button>
        <p className="text-white/40 text-sm">Takes about 2 minutes</p>
      </div>

      {/* FAQ */}
      <div className="bg-neutral-800 border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold text-lg mb-4">Common questions</h3>
        <div className="space-y-0">
          <FAQItem 
            question="Do I need a Stripe account?"
            answer="No — you just confirm your payout details securely"
          />
          <FAQItem 
            question="When do I get paid?"
            answer="Funds arrive automatically after orders"
          />
          <FAQItem 
            question="Is this secure?"
            answer="Yes — bank level encryption"
          />
        </div>
      </div>
    </div>
  );
};
