import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '../types';

interface AuthContextValue {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string, orgName: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    await fetchProfile(session.user.id);
                } else {
                    setProfile(null);
                    setLoading(false);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    async function fetchProfile(userId: string) {
        try {
            // Add timeout to prevent infinite loading
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .abortSignal(controller.signal)
                .single();

            clearTimeout(timeoutId);

            if (error) {
                console.error('❌ Profile fetch error:', {
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    status: error.status
                });

                // If profile doesn't exist, that's okay - user might need to complete setup
                if (error.code === 'PGRST116') {
                    console.warn('⚠️ Profile not found for user:', userId);
                    setProfile(null);
                } else if (error.code === '42501' || error.message?.includes('infinite recursion')) {
                    console.error('🔄 Database recursion error - RLS policies need fixing');
                    setProfile(null);
                } else {
                    // For other errors (like 500), log but don't crash
                    console.error('⚠️ Unexpected profile error, continuing without profile');
                    setProfile(null);
                }
            } else {
                console.log('✅ Profile loaded successfully');
                setProfile(data);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error('⏱️ Profile fetch timeout - check database connection');
            } else {
                console.error('❌ Profile fetch exception:', error);
            }
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }

    async function signIn(email: string, password: string) {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Profile will be fetched automatically by onAuthStateChange
        } catch (error: any) {
            setLoading(false);
            throw new Error(error.message || 'Failed to sign in');
        }
    }

    async function signUp(email: string, password: string, fullName: string, orgName: string) {
        setLoading(true);
        try {
            // 1. Sign up user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('Failed to create user');

            // 2. Initialize account via Edge Function
            const { data, error: funcError } = await supabase.functions.invoke('owner_initialize_account', {
                body: { full_name: fullName, org_name: orgName }
            });

            if (funcError) throw funcError;

            // Profile will be fetched automatically by onAuthStateChange
        } catch (error: any) {
            setLoading(false);
            throw new Error(error.message || 'Failed to sign up');
        }
    }

    async function signOut() {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (error: any) {
            console.error('Error signing out:', error);
            throw new Error(error.message || 'Failed to sign out');
        } finally {
            setLoading(false);
        }
    }

    const value: AuthContextValue = {
        user,
        profile,
        session,
        loading,
        signIn,
        signUp,
        signOut,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
