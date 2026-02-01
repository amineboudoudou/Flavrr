import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { Eye, EyeOff, ShoppingBag } from 'lucide-react';

export const OwnerLogin: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { signIn, user, loading: authLoading } = useAuth();
    const { memberships, loading: workspaceLoading } = useWorkspace();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const from = (location.state as any)?.from?.pathname || null;

    // If user is already logged in, redirect based on workspace count
    useEffect(() => {
        if (user && !authLoading && !workspaceLoading) {
            if (from) {
                navigate(from, { replace: true });
            } else if (memberships.length === 0) {
                navigate('/onboarding/create-workspace', { replace: true });
            } else if (memberships.length === 1) {
                navigate(`/app/${memberships[0].slug}`, { replace: true });
            } else {
                navigate('/select-workspace', { replace: true });
            }
        }
    }, [user, authLoading, workspaceLoading, memberships, from, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        if (!email || !password) {
            setError('Please enter both email and password');
            setIsSubmitting(false);
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            setIsSubmitting(false);
            return;
        }

        try {
            await signIn(email, password);
            // Redirection will be handled by useEffect after workspace data loads
        } catch (err: any) {
            setError(err.message || 'Failed to sign in');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-white flex items-center justify-center px-4 relative overflow-hidden">
            {/* Subtle gradient glow */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-orange-100/40 to-transparent blur-3xl pointer-events-none"></div>
            
            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-2 rounded-xl">
                            <ShoppingBag className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-gray-900 font-serif text-3xl font-bold tracking-tight">
                                CAFÉ DU GRIOT
                            </h1>
                        </div>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">
                        Owner Portal
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.12)] p-8">
                    <h2 className="text-gray-900 text-2xl font-bold mb-6">Sign In</h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-2">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                placeholder="owner@cafedugriot.com"
                                disabled={isSubmitting || authLoading}
                                autoComplete="email"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label htmlFor="password" className="block text-gray-700 text-sm font-medium">
                                    Password
                                </label>
                                <Link to="/owner/forgot-password" className="text-xs text-orange-600 hover:text-orange-700 font-medium">
                                    Forgot?
                                </Link>
                            </div>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 pr-12 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                    placeholder="••••••••"
                                    disabled={isSubmitting || authLoading}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-red-600 text-sm font-medium">{error}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isSubmitting || authLoading}
                            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {isSubmitting ? 'Signing in...' : authLoading ? 'Checking session...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-gray-600 text-sm">
                            Don't have an account?{' '}
                            <Link to="/owner/signup" className="text-orange-600 hover:text-orange-700 font-semibold">
                                Create one
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-gray-400 text-xs text-center mt-6">
                    © {new Date().getFullYear()} Café Du Griot. All rights reserved.
                </p>
            </div>
        </div>
    );
};
