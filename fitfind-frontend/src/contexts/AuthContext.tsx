'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { 
  onAuthStateChange, 
  getCurrentSession, 
  getUserProfile,
  type AuthState, 
  type UserProfile,
  type SignUpData,
  type SignInData,
  signUp as authSignUp,
  signIn as authSignIn,
  signOut as authSignOut
} from '@/lib/auth'

interface AuthContextType extends AuthState {
  signUp: (data: SignUpData) => Promise<{ success: boolean; error?: string }>
  signIn: (data: SignInData) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<{ success: boolean; error?: string }>
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true
  });

  const mountedRef = useRef(true);
  const initializingRef = useRef(false);

  const setAuthState = useCallback((newState: Partial<AuthState>) => {
    if (mountedRef.current) {
      setState(prevState => ({ ...prevState, ...newState }));
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;
    
    try {
      const session = await getCurrentSession();
      if (session?.user) {
        const profile = await getUserProfile();
        setAuthState({
          user: session.user,
          profile,
          session,
          loading: false
        });
      } else {
        setAuthState({
          user: null,
          profile: null,
          session: null,
          loading: false
        });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      setAuthState({
        user: null,
        profile: null,
        session: null,
        loading: false
      });
    } finally {
      initializingRef.current = false;
    }
  }, [setAuthState]);
  
  useEffect(() => {
    mountedRef.current = true;
    initializeAuth();

    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (mountedRef.current) {
        if (event === 'SIGNED_IN') {
          const profile = await getUserProfile();
          setAuthState({ user: session?.user || null, profile, session, loading: false });
        } else if (event === 'SIGNED_OUT') {
          setAuthState({ user: null, profile: null, session: null, loading: false });
        }
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [initializeAuth]);

  const signUp = async (data: SignUpData) => {
    setState(prev => ({ ...prev, loading: true }))
    try {
      const result = await authSignUp(data)
      return result.success ? { success: true } : { success: false, error: result.error }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Sign up failed' }
    } finally {
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const signIn = async (data: SignInData) => {
    setState(prev => ({ ...prev, loading: true }))
    try {
      const result = await authSignIn(data)
      return result.success ? { success: true } : { success: false, error: result.error }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Sign in failed' }
    } finally {
      // The onAuthStateChange listener will handle setting the new state
    }
  }

  const signOut = async () => {
    setState(prev => ({ ...prev, loading: true }))
    try {
      const result = await authSignOut()
      return result.success ? { success: true } : { success: false, error: result.error }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Sign out failed' }
    } finally {
      // The onAuthStateChange listener will handle setting the new state
    }
  }

  const refreshProfile = useCallback(async () => {
    if (state.user) {
      const profile = await getUserProfile();
      setAuthState({ profile });
    }
  }, [state.user, setAuthState]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    // This function would call a backend endpoint to update the profile
    // For now, it just refreshes the profile data
    await refreshProfile();
    return { success: true };
  }

  const value: AuthContextType = {
    ...state,
    signUp,
    signIn,
    signOut,
    refreshProfile,
    updateProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper hooks
export function useUser() {
  return useAuth().user;
}

export function useProfile() {
  return useAuth().profile;
}

export function useIsAuthenticated() {
  const { user, loading } = useAuth();
  return { isAuthenticated: !!user, loading };
}