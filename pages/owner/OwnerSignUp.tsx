import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const OwnerSignUp: React.FC = () => {
    const navigate = useNavigate();
    const { signUp, loading } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [orgName, setOrgName] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !password || !fullName || !orgName) {
            setError('Please fill in all fields');
            return;
        }

        try {
            await signUp(email, password, fullName, orgName);
            navigate('/owner', { replace: true });
        } catch (err: any) {
            setError(err.message || 'Failed to sign up');
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-white font-serif text-3xl font-bold tracking-widest mb-2">
                        CAFÉ DU GRIOT
                    </h1>
                    <p className="text-white/40 text-xs uppercase tracking-[0.3em] font-bold">
                        Owner Registration
                    </p>
                </div>

                {/* Registration Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                    <h2 className="text-white text-xl font-semibold mb-6">Create Account</h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Full Name */}
                        <div>
                            <label htmlFor="fullName" className="block text-white/70 text-sm mb-1">
                                Full Name
                            </label>
                            <input
                                id="fullName"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-primary transition-colors"
                                placeholder="Jean Dupont"
                                disabled={loading}
                            />
                        </div>

                        {/* Organization Name */}
                        <div>
                            <label htmlFor="orgName" className="block text-white/70 text-sm mb-1">
                                Restaurant Name
                            </label>
                            <input
                                id="orgName"
                                type="text"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-primary transition-colors"
                                placeholder="My Haitian Kitchen"
                                disabled={loading}
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-white/70 text-sm mb-1">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-primary transition-colors"
                                placeholder="owner@kitchen.com"
                                disabled={loading}
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-white/70 text-sm mb-1">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-primary transition-colors"
                                placeholder="••••••••"
                                disabled={loading}
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
                            disabled={loading}
                            className="w-full bg-primary hover:bg-accent text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {loading ? 'Creating Account...' : 'Register'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-white/40 text-sm">
                            Already have an account?{' '}
                            <Link to="/owner/login" className="text-primary hover:underline font-medium">
                                Sign In
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
