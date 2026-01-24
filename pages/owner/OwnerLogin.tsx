import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const OwnerLogin: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { signIn, user, loading: authLoading } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const from = (location.state as any)?.from?.pathname || '/owner';

    // If user is already logged in and we're not checking the session, redirect
    useEffect(() => {
        if (user && !authLoading) {
            navigate(from, { replace: true });
        }
    }, [user, authLoading, navigate, from]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        if (!email || !password) {
            setError('Please enter both email and password');
            setIsSubmitting(false);
            return;
        }

        try {
            await signIn(email, password);
            // Redirection will be handled by useEffect
        } catch (err: any) {
            setError(err.message || 'Failed to sign in');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-white font-serif text-3xl font-bold tracking-widest mb-2">
                        CAFÉ DU GRIOT
                    </h1>
                    <p className="text-white/40 text-xs uppercase tracking-[0.3em] font-bold">
                        Owner Portal
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                    <h2 className="text-white text-xl font-semibold mb-6">Sign In</h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-white/70 text-sm mb-2">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary transition-colors"
                                placeholder="owner@cafedugriot.com"
                                disabled={isSubmitting || authLoading}
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-white/70 text-sm mb-2">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary transition-colors"
                                placeholder="••••••••"
                                disabled={isSubmitting || authLoading}
                            />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isSubmitting || authLoading}
                            className="w-full bg-primary hover:bg-accent text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Signing in...' : authLoading ? 'Checking session...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-white/40 text-sm">
                            Don't have an account?{' '}
                            <Link to="/owner/signup" className="text-primary hover:underline font-medium">
                                Create one
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-white/20 text-xs text-center mt-6">
                    © {new Date().getFullYear()} Café Du Griot. All rights reserved.
                </p>
            </div>
        </div>
    );
};
