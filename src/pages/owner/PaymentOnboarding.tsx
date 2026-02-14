import React, { useState } from 'react';
import { TrustCard } from '../../components/owner/TrustCard';
import { StepItem } from '../../components/owner/StepItem';
import { FAQItem } from '../../components/owner/FAQItem';

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
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-white text-2xl font-semibold mb-2">You&apos;re all set!</h2>
          <p className="text-white/60 text-base">
            {stripeAccountStatus === 'complete' 
              ? 'Your account is ready to receive payouts.'
              : 'Your account is being verified. You&apos;ll be able to receive payouts soon.'}
          </p>
        </div>

        {/* What's Next */}
        <div className="bg-neutral-800 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold text-base mb-4">What happens next?</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-white/70">Customers can place orders and pay through your storefront</p>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-white/70">Funds are automatically transferred to your bank account</p>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-white/70">Track all transactions in your Stripe dashboard</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Trust Header */}
      <div className="flex flex-wrap items-center justify-center gap-6 py-4 px-6 bg-neutral-800/30 border border-white/5 rounded-xl">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#635BFF]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/>
          </svg>
          <span className="text-white/70 text-sm font-medium">Powered by Stripe</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-white/70 text-sm font-medium">Secure payments</span>
        </div>
      </div>

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-white text-2xl md:text-3xl font-semibold">Get paid automatically</h1>
        <p className="text-white/50 text-sm md:text-base">Connect where you want to receive money from orders</p>
      </div>

      {/* Trust Card */}
      <TrustCard 
        items={[
          'Payments go directly to your bank',
          'Flavrr never holds your funds',
          'Card details are handled securely by Stripe'
        ]}
      />

      {/* How it Works */}
      <div className="bg-neutral-800 border border-white/10 rounded-2xl p-6">
        <h2 className="text-white text-base font-semibold mb-5">How it works</h2>
        <div className="space-y-5">
          <StepItem 
            number={1}
            title="Enter your business details"
            description="Business info for payouts"
          />
          <StepItem 
            number={2}
            title="Add your bank account"
            description="Connect your bank securely"
          />
          <StepItem 
            number={3}
            title="Start receiving payouts automatically"
            description="Get paid after each order"
          />
        </div>
      </div>

      {/* CTA Button */}
      <div className="text-center space-y-3 py-2">
        <button
          onClick={handleConnect}
          disabled={loading}
          className="bg-gradient-to-r from-primary to-accent hover:from-accent hover:to-primary text-white px-12 py-4 rounded-xl font-semibold text-base transition-all hover:shadow-lg disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-neutral-900"
        >
          {loading ? 'Connecting...' : 'Connect payouts'}
        </button>
        <p className="text-white/40 text-sm">Takes about 2 minutes</p>
        <div className="flex flex-col items-center gap-1 pt-2">
          <p className="text-white/30 text-xs">You can disconnect anytime</p>
          <p className="text-white/30 text-xs">Need help? Contact support</p>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-neutral-800 border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold text-base mb-4">Common questions</h3>
        <div className="space-y-0">
          <FAQItem 
            question="Do I need a Stripe account?"
            answer="No — you'll confirm payout details securely through Stripe. It's a standard step for getting paid."
          />
          <FAQItem 
            question="When do I get paid?"
            answer="Funds are transferred automatically after orders, based on your payout schedule."
          />
          <FAQItem 
            question="Is this secure?"
            answer="Yes — payments are processed by Stripe and Flavrr never stores your card numbers."
          />
        </div>
      </div>

      {/* Additional Trust Footer */}
      <div className="text-center py-4">
        <p className="text-white/30 text-xs">Flavrr never stores card numbers. All payment data is handled securely by Stripe.</p>
      </div>
    </div>
  );
};
