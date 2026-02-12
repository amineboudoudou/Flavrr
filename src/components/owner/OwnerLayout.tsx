import React, { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogoIcon } from '../Icons';
import {
    Home,
    Package,
    UtensilsCrossed,
    Star,
    Users,
    Mail,
    Gift,
    Settings as SettingsIcon,
    ExternalLink,
    Menu,
    LogOut,
} from 'lucide-react';

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
        { label: 'Home', path: `/app/${slug}`, icon: Home },
        { label: 'Orders', path: `/app/${slug}/orders`, icon: Package },
        { label: 'Products', path: `/app/${slug}/products`, icon: UtensilsCrossed },
        { label: 'Reviews', path: `/app/${slug}/reviews`, icon: Star },
        { label: 'Customers', path: `/app/${slug}/customers`, icon: Users },
        { label: 'Marketing', path: `/app/${slug}/marketing`, icon: Mail },
        { label: 'Promos', path: `/app/${slug}/promos`, icon: Gift },
        { label: 'Settings', path: `/app/${slug}/settings`, icon: SettingsIcon },
        { label: 'View Store', path: `/order/${slug}`, icon: ExternalLink, isExternal: true },
    ];

    const isActive = (path: string) => {
        if (path === `/app/${slug}`) {
            return location.pathname === `/app/${slug}`;
        }
        return location.pathname.startsWith(path);
    };

    return (
        <div className="owner-theme min-h-screen bg-bg text-text flex">
            {/* Sidebar */}
            <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-surface border-r border-border transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                {/* Logo */}
                <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
                    <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center shadow-[var(--shadow)]">
                        <LogoIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-text font-serif text-sm font-bold truncate">{activeWorkspace?.name || 'Workspace'}</h1>
                        <p className="text-muted text-[10px] uppercase tracking-widest">Dashboard</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-1">
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
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius)] transition-colors ${!('isExternal' in item && item.isExternal) && isActive(item.path)
                                ? 'bg-surface-2 text-text border border-border'
                                : 'text-muted hover:text-text hover:bg-surface-2'
                                }`}
                        >
                            <span className={`w-9 h-9 rounded-xl flex items-center justify-center border ${!('isExternal' in item && item.isExternal) && isActive(item.path)
                                ? 'bg-primary text-white border-primary'
                                : 'bg-surface text-muted border-border'
                                }`}>
                                <item.icon className="w-4 h-4" />
                            </span>
                            <span className="font-medium text-sm">{item.label}</span>
                        </button>
                    ))}
                </nav>

                {/* User Info at Bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-surface">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center flex-shrink-0">
                            <span className="text-primary font-bold text-sm">
                                {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-text text-sm font-medium truncate">
                                {profile?.full_name || 'User'}
                            </p>
                            <p className="text-muted text-xs capitalize">
                                {profile?.role || 'owner'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="w-full px-3 py-2 text-sm text-muted hover:text-text hover:bg-surface-2 rounded-[var(--radius)] transition-colors text-left flex items-center gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile Sidebar Backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile Top Bar */}
                <header className="md:hidden bg-surface border-b border-border sticky top-0 z-30">
                    <div className="h-16 flex items-center justify-between px-4">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="text-text p-2 hover:bg-surface-2 rounded-[var(--radius)] transition-colors"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <LogoIcon className="w-8 h-8 text-primary" />
                        <div className="w-10" /> {/* Spacer for centering */}
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-auto bg-bg">
                    {children}
                </main>
            </div>
        </div>
    );
};
