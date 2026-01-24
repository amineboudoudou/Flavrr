import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/owner/ProtectedRoute';

// Storefront (renamed from App.tsx)
import Storefront from './Storefront';

// Owner Portal Pages
import { OwnerLogin } from './pages/owner/OwnerLogin';
import { OwnerSignUp } from './pages/owner/OwnerSignUp';
import { OrdersBoard } from './pages/owner/OrdersBoard';
import { OrderDetail } from './pages/owner/OrderDetail';
import { Settings } from './pages/owner/Settings';

const AppRoutes: React.FC = () => {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    {/* Customer Storefront */}
                    <Route path="/" element={<Storefront />} />

                    {/* Owner Portal */}
                    <Route path="/owner/login" element={<OwnerLogin />} />
                    <Route path="/owner/signup" element={<OwnerSignUp />} />

                    <Route
                        path="/owner"
                        element={
                            <ProtectedRoute>
                                <OrdersBoard />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/owner/orders/:id"
                        element={
                            <ProtectedRoute>
                                <OrderDetail />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/owner/settings"
                        element={
                            <ProtectedRoute>
                                <Settings />
                            </ProtectedRoute>
                        }
                    />

                    {/* Catch all - redirect to home */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
};

export default AppRoutes;
