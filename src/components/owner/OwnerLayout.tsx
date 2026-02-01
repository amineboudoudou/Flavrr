import React, { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogoIcon } from '../Icons';

interface OwnerLayoutProps {
    children: ReactNode;
}

export const OwnerLayout: React.FC<OwnerLayoutProps> = ({ children }) => {
    const { profile, signOut } = useAuth();
    const { activeWorkspace } = useWorkspace();
    const navigate = useNavigate();
    const location = useLocation();
    const [userMenuOpen, setUserMenuOpen] = React.useState(false);
    const [sidebarOpen, setSidebarOpen] = React.useState(false);
    
    const slug = activeWorkspace?.slug || '';

    const handleSignOut = async () => {
        try {
            await signOut();
            localStorage.removeItem('flavrr_active_workspace');
            navigate('/login');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    const navItems = [
        { label: 'Home', path: `/app/${slug}`, icon: '🏠' },
        { label: 'Orders', path: `/app/${slug}/orders`, icon: '📦' },
        { label: 'Products', path: `/app/${slug}/products`, icon: '🍽️' },
        { label: 'Reviews', path: `/app/${slug}/reviews`, icon: '⭐' },
        { label: 'Customers', path: `/app/${slug}/customers`, icon: '👥' },
        { label: 'Marketing', path: `/app/${slug}/marketing`, icon: '📧' },
        { label: 'Promos', path: `/app/${slug}/promos`, icon: '🎁' },
        { label: 'Settings', path: `/app/${slug}/settings`, icon: '⚙️' },
        { label: 'View Store', path: `/order/${slug}`, icon: '🌐', isExternal: true },
    ];

    const isActive = (path: string) => {
        if (path === `/app/${slug}`) {
            return location.pathname === `/app/${slug}`;
        }
        return location.pathname.startsWith(path);
    };

    return (
        <div className="min-h-screen bg-neutral-900 flex">
            {/* Sidebar */}
            <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-black border-r border-white/10 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                {/* Logo */}
                <div className="h-16 flex items-center gap-3 px-6 border-b border-white/10">
                    <LogoIcon className="w-8 h-8 text-primary" />
                    <div className="flex-1 min-w-0">
                        <h1 className="text-white font-serif text-sm font-bold truncate">{activeWorkspace?.name || 'Workspace'}</h1>
                        <p className="text-white/40 text-[9px] uppercase tracking-widest">Dashboard</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-2">
                    {navItems.map((item) => (
                        <button
                            key={item.path}
                            onClick={() => {
                                if ('isExternal' in item && item.isExternal) {
                                    window.open(item.path, '_blank', 'noopener,noreferrer');
                                } else {
                                    navigate(item.path);
                                    setSidebarOpen(false);
                                }
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${!('isExternal' in item && item.isExternal) && isActive(item.path)
                                ? 'bg-primary text-white'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <span className="text-xl">{item.icon}</span>
                            <span className="font-medium">{item.label}</span>
                        </button>
                    ))}
                </nav>

                {/* User Info at Bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-bold text-sm">
                                {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                                {profile?.full_name || 'User'}
                            </p>
                            <p className="text-white/40 text-xs capitalize">
                                {profile?.role || 'owner'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="w-full px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded transition-colors text-left"
                    >
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile Sidebar Backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile Top Bar */}
                <header className="md:hidden bg-black border-b border-white/10 sticky top-0 z-30">
                    <div className="h-16 flex items-center justify-between px-4">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="text-white p-2 hover:bg-white/5 rounded-lg transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <LogoIcon className="w-8 h-8 text-primary" />
                        <div className="w-10" /> {/* Spacer for centering */}
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
};
