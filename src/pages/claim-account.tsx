import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ClaimAccountPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ordersClaimed, setOrdersClaimed] = useState(0);

  useEffect(() => {
    if (!session) {
      navigate('/login?redirect=/claim-account');
    }
  }, [session, navigate]);

  const handleClaim = async () => {
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/claim_customer_account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to claim account');
      }

      if (data.success) {
        setSuccess(true);
        setOrdersClaimed(data.orders_claimed);
      } else {
        setError(data.error || 'No orders found to claim');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <main className="max-w-lg mx-auto p-6 mt-12">
      <h1 className="text-2xl font-semibold mb-4">Claim your past orders</h1>

      {!success ? (
        <>
          <p className="text-sm text-gray-600 mb-6">
            Link your past guest orders to this account. We'll look for orders placed with{' '}
            <strong>{session.user.email}</strong>.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded font-medium disabled:opacity-60"
          >
            {loading ? 'Claiming orders...' : 'Claim my orders'}
          </button>

          <p className="text-xs text-gray-500 mt-4">
            This will link all past orders placed with your email to this account.
          </p>
        </>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded p-6 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-lg font-semibold text-green-900 mb-2">Account claimed!</h2>
          <p className="text-sm text-green-700 mb-4">
            {ordersClaimed === 0
              ? 'No past orders found, but future orders will be linked to your account.'
              : `${ordersClaimed} past order${ordersClaimed > 1 ? 's' : ''} now linked to your account.`}
          </p>
          <button
            onClick={() => navigate('/orders')}
            className="bg-green-600 text-white px-6 py-2 rounded font-medium"
          >
            View my orders
          </button>
        </div>
      )}
    </main>
  );
}
