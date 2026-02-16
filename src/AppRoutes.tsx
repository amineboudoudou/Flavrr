import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { ProtectedRoute } from './components/owner/ProtectedRoute';
import { AuthGate } from './components/AuthGate';
import { WorkspaceGate } from './components/WorkspaceGate';

// Landing Page
import { Landing } from './Landing/Landing';

// Storefront (renamed from App.tsx)
import Storefront from './Storefront';

// Owner Portal Pages
import { OwnerLogin } from './pages/owner/OwnerLogin';
import { OwnerSignUp } from './pages/owner/OwnerSignUp';
import { OrdersBoard } from './pages/owner/OrdersBoard';
import { OrderDetail } from './pages/owner/OrderDetail';
import { MenuManagement } from './pages/owner/MenuManagement';
import { Settings } from './pages/owner/Settings';
import { Reviews } from './pages/owner/Reviews';
import { Customers } from './pages/owner/Customers';
import { CustomerDetail } from './pages/owner/CustomerDetail';
import { EmailMarketing } from './pages/owner/EmailMarketing';
import { Promos } from './pages/owner/Promos';

// Public Pages
import { PublicTracking } from './pages/PublicTracking';

// Workspace Pages
import { SelectWorkspace } from './pages/SelectWorkspace';
import { CreateWorkspace } from './pages/CreateWorkspace';
import { WorkspaceHome } from './pages/WorkspaceHome';

import { APIProvider } from '@vis.gl/react-google-maps';

const AppRoutes: React.FC = () => {
    return (
        <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
            <BrowserRouter>
                <AuthProvider>
                    <WorkspaceProvider>
                        <Routes>
                        {/* SaaS Landing Page */}
                        <Route path="/" element={<Landing />} />

                        {/* Legacy demo route - redirect to real login */}
                        <Route path="/demo-login" element={<Navigate to="/owner/login" replace />} />

                        {/* Customer Storefront - Café Griot */}
                        <Route path="/order" element={<Storefront />} />
                        <Route path="/order/:slug" element={<Storefront />} />

                        {/* Authentication */}
                        <Route path="/login" element={<OwnerLogin />} />
                        <Route path="/signup" element={<OwnerSignUp />} />
                        
                        {/* Legacy owner routes - redirect to new auth routes */}
                        <Route path="/owner/login" element={<Navigate to="/login" replace />} />
                        <Route path="/owner/signup" element={<Navigate to="/signup" replace />} />
                        
                        {/* Workspace Selection & Onboarding */}
                        <Route path="/select-workspace" element={<AuthGate><SelectWorkspace /></AuthGate>} />
                        <Route path="/onboarding/create-workspace" element={<AuthGate><CreateWorkspace /></AuthGate>} />
                        
                        {/* Workspace-Scoped SaaS App */}
                        <Route path="/app/:slug" element={<AuthGate><WorkspaceGate><WorkspaceHome /></WorkspaceGate></AuthGate>} />
                        <Route path="/app/:slug/orders" element={<AuthGate><WorkspaceGate><ProtectedRoute><OrdersBoard /></ProtectedRoute></WorkspaceGate></AuthGate>} />
                        <Route path="/app/:slug/orders/:id" element={<AuthGate><WorkspaceGate><ProtectedRoute><OrderDetail /></ProtectedRoute></WorkspaceGate></AuthGate>} />
                        <Route path="/app/:slug/products" element={<AuthGate><WorkspaceGate><ProtectedRoute><MenuManagement /></ProtectedRoute></WorkspaceGate></AuthGate>} />
                        <Route path="/app/:slug/settings" element={<AuthGate><WorkspaceGate><ProtectedRoute><Settings /></ProtectedRoute></WorkspaceGate></AuthGate>} />
                        <Route path="/app/:slug/reviews" element={<AuthGate><WorkspaceGate><ProtectedRoute><Reviews /></ProtectedRoute></WorkspaceGate></AuthGate>} />
                        <Route path="/app/:slug/customers" element={<AuthGate><WorkspaceGate><ProtectedRoute><Customers /></ProtectedRoute></WorkspaceGate></AuthGate>} />
                        <Route path="/app/:slug/customers/:id" element={<AuthGate><WorkspaceGate><ProtectedRoute><CustomerDetail /></ProtectedRoute></WorkspaceGate></AuthGate>} />
                        <Route path="/app/:slug/marketing" element={<AuthGate><WorkspaceGate><ProtectedRoute><EmailMarketing /></ProtectedRoute></WorkspaceGate></AuthGate>} />
                        <Route path="/app/:slug/promos" element={<AuthGate><WorkspaceGate><ProtectedRoute><Promos /></ProtectedRoute></WorkspaceGate></AuthGate>} />

                        {/* Legacy /owner routes - redirect to workspace selection */}
                        <Route path="/owner" element={<Navigate to="/select-workspace" replace />} />
                        <Route path="/owner/*" element={<Navigate to="/select-workspace" replace />} />

                        {/* Public Tracking */}
                        <Route path="/t/:token" element={<PublicTracking />} />

                        {/* Storefront at root slug - must be before catch-all */}
                        <Route path="/:slug" element={<Storefront />} />

                        {/* Catch all - redirect to home */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </WorkspaceProvider>
                </AuthProvider>
            </BrowserRouter>
        </APIProvider>
    );
};

export default AppRoutes;
