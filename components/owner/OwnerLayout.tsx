import React, { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogoIcon } from '../Icons';

interface OwnerLayoutProps {
    children: ReactNode;
}

export const OwnerLayout: React.FC<OwnerLayoutProps> = ({ children }) => {
    const { profile, signOut } = useAuth();
    const [userMenuOpen, setUserMenuOpen] = React.useState(false);

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-900 flex flex-col">
            {/* Top Bar */}
            <header className="bg-black border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-[1920px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                    {/* Logo & Restaurant Name */}
                    <div className="flex items-center gap-4">
                        <LogoIcon className="w-8 h-8 text-primary" />
                        <div className="hidden md:block">
                            <h1 className="text-white font-serif text-lg font-bold">CAFÉ DU GRIOT</h1>
                            <p className="text-white/40 text-[10px] uppercase tracking-widest">Owner Portal</p>
                        </div>
                    </div>

                    {/* Center - Status (optional, can add open/closed toggle here) */}
                    <div className="flex items-center gap-3">
                        {/* Could add an "Open/Closed" toggle here */}
                    </div>

                    {/* Right - User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <div className="text-right hidden sm:block">
                                <p className="text-white text-sm font-medium">{profile?.full_name || 'User'}</p>
                                <p className="text-white/40 text-xs capitalize">{profile?.role || 'owner'}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                                <span className="text-primary font-bold text-sm">
                                    {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                                </span>
                            </div>
                        </button>

                        {/* Dropdown */}
                        {userMenuOpen && (
                            <>
                                {/* Backdrop */}
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setUserMenuOpen(false)}
                                />

                                {/* Menu */}
                                <div className="absolute right-0 mt-2 w-56 bg-neutral-800 border border-white/10 rounded-lg shadow-2xl z-50">
                                    <div className="p-3 border-b border-white/10">
                                        <p className="text-white text-sm font-medium">{profile?.full_name}</p>
                                        <p className="text-white/40 text-xs">{profile?.email}</p>
                                    </div>

                                    <div className="p-2">
                                        <button
                                            onClick={handleSignOut}
                                            className="w-full text-left px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded transition-colors"
                                        >
                                            Sign Out
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1">
                {children}
            </main>
        </div>
    );
};
