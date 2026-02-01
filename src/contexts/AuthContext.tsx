import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '../types';

interface AuthContextValue {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    loading: boolean;
    profileLoading: boolean;
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
    const [profileLoading, setProfileLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;

        // 1. Get initial session
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                if (!isMounted) return;

                setSession(session);
                setUser(session?.user ?? null);

                // Set loading to false as soon as we have a session
                // The profile will load in the background
                setLoading(false);

                if (session?.user) {
                    fetchProfile(session.user.id);
                }
            })
            .catch(err => {
                if (!isMounted) return;

                // AbortError is expected on page refresh/navigation - ignored intentionally
                if (err?.name === 'AbortError') {
                    console.warn('⚠️ Auth session retrieval aborted (likely page refresh)');
                    return;
                }

                console.error('❌ Auth session retrieval failed:', err);
                setLoading(false);
            });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (!isMounted) return;

                console.log('🔄 Auth state changed:', event);

                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    // Only fetch profile on specific events to avoid redundant calls
                    // No need to await here - we want FAST navigation
                    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                        fetchProfile(session.user.id);
                    } else if (event === 'INITIAL_SESSION' && !profile) {
                        fetchProfile(session.user.id);
                    }
                    setLoading(false);
                } else {
                    setProfile(null);
                    setLoading(false);
                }
            }
        );

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []); // Empty deps - run once

    async function fetchProfile(userId: string) {
        if (!userId) return;

        console.log('👤 Fetching profile for user:', userId);
        setProfileLoading(true);

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
                    hint: error.hint
                });

                // If profile doesn't exist, that's okay - user might need to complete setup
                if (error.code === 'PGRST116') {
                    console.warn('⚠️ Profile not found for user:', userId);
                } else if (error.code === '42501' || error.message?.includes('infinite recursion')) {
                    console.error('🔄 Database recursion error - RLS policies need fixing');
                } else {
                    console.error('⚠️ Unexpected profile error:', {
                        code: error.code,
                        message: error.message,
                        details: error.details,
                        hint: error.hint
                    });
                }

                setProfile(null);
            } else {
                console.log('✅ Profile loaded successfully:', {
                    userId: data.user_id,
                    orgId: data.org_id,
                    role: data.role,
                    fullName: data.full_name
                });
                setProfile(data);
            }
        } catch (error: any) {
            // AbortError is expected on page refresh/navigation - ignored intentionally
            if (error?.name === 'AbortError') {
                console.warn('⚠️ Profile fetch aborted (likely page refresh)');
                return;
            }

            console.error('❌ Profile fetch exception:', {
                name: error?.name,
                message: error?.message
            });
            setProfile(null);
        } finally {
            setProfileLoading(false);
            console.log('🏁 Profile fetch complete');
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
        profileLoading,
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
