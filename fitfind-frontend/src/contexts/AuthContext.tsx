'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { 
  onAuthStateChange, 
  getCurrentSession, 
  getUserProfile,
  createUserProfile,
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
  const subscriptionRef = useRef<any>(null);
  const initializingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Stable setState that only updates if values actually changed
  const setAuthState = useCallback((newState: AuthState) => {
    setState(prevState => {
      // Deep comparison to prevent unnecessary updates
      const hasUserChanged = prevState.user?.id !== newState.user?.id;
      const hasProfileChanged = JSON.stringify(prevState.profile) !== JSON.stringify(newState.profile);
      const hasSessionChanged = prevState.session?.access_token !== newState.session?.access_token;
      const hasLoadingChanged = prevState.loading !== newState.loading;

      if (!hasUserChanged && !hasProfileChanged && !hasSessionChanged && !hasLoadingChanged) {
        return prevState;
      }

      return newState;
    });
  }, []);

  // Initialize auth state only once
  useEffect(() => {
    if (initializingRef.current) {
      return;
    }

    initializingRef.current = true;
    
    async function initializeAuth() {
      try {
        const session = await getCurrentSession();
        
        if (!mountedRef.current) return;
        if (session?.user) {
          let profile = await getUserProfile(session.user.id);
          
          if (!profile && session.user.email) {
            const result = await createUserProfile(session.user.id, {
              email: session.user.email,
              full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name
            });
            if (result.success) {
              profile = await getUserProfile(session.user.id);
            }
          }
          
          lastUserIdRef.current = session.user.id;
          setAuthState({
            user: session.user,
            profile,
            session,
            loading: false
          });
        } else {
          lastUserIdRef.current = null;
          setAuthState({
            user: null,
            profile: null,
            session: null,
            loading: false
          });
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mountedRef.current) {
          setAuthState({
            user: null,
            profile: null,
            session: null,
            loading: false
          });
        }
      } finally {
        initializingRef.current = false;
      }
    }

    initializeAuth();

    // Auth state change handler
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;

      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        if (session?.user) {
          // Only proceed if user actually changed
          if (lastUserIdRef.current === session.user.id) {
            return;
          }
          
          // Set loading only for actual user changes
          setState(prev => ({ ...prev, loading: true }));
          try {
            let profile = await getUserProfile(session.user.id);
            
            if (!profile && session.user.email) {
              const result = await createUserProfile(session.user.id, {
                email: session.user.email,
                full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name
              });
              if (result.success) {
                profile = await getUserProfile(session.user.id);
              }
            }
            if (mountedRef.current) {
              setAuthState({
                user: session.user,
                profile,
                session,
                loading: false
              });
            }
          } catch (error) {
            console.error('Error in auth state change:', error);
            if (mountedRef.current) {
              setAuthState({
                user: session.user,
                profile: null,
                session,
                loading: false
              });
            }
          }
        } else {
          lastUserIdRef.current = null;
          setAuthState({
            user: null,
            profile: null,
            session: null,
            loading: false
          });
        }
      }
    });

    subscriptionRef.current = subscription;

    return () => {
      mountedRef.current = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []); // Empty deps, runs only once

  const signUp = async (data: SignUpData) => {
    setState(prev => ({ ...prev, loading: true }))
    
    try {
      const result = await authSignUp(data)
      
      if (result.success && result.data?.user) {
        console.log('Signup successful, user created:', result.data.user.email)
        
        // For confirmed users (no email verification needed), immediately try to create profile
        if (result.data.user.email_confirmed_at) {
          console.log('User email confirmed, creating profile immediately...')
          const profileResult = await createUserProfile(result.data.user.id, {
            email: result.data.user.email,
            full_name: result.data.user.user_metadata?.full_name
          })
          if (profileResult.success) {
            console.log('Profile created immediately after signup')
          }
        }
        
        return { success: true }
      }
      
      return { success: false, error: result.error }
    } catch (error) {
      console.error('Signup error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Sign up failed' 
      }
    } finally {
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const signIn = async (data: SignInData) => {
    setState(prev => ({ ...prev, loading: true }))
    
    try {
      const result = await authSignIn(data)
      
      if (result.success) {
        console.log('Sign-in successful')
        // Auth state will be updated by the listener
        return { success: true }
      }
      
      return { success: false, error: result.error }
    } catch (error) {
      console.error('Sign-in error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Sign in failed' 
      }
    } finally {
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const signOut = async () => {
    setState(prev => ({ ...prev, loading: true }))
    
    try {
      const result = await authSignOut()
      
      if (result.success) {
        // Auth state will be updated by the listener
        return { success: true }
      }
      
      return { success: false, error: result.error }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Sign out failed' 
      }
    } finally {
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  const refreshProfile = async () => {
    if (!state.user) return
    try {
      const profile = await getUserProfile(state.user.id)
      setState(prev => ({ ...prev, profile }))
    } catch (error) {
      console.error('Error refreshing profile:', error)
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!state.user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      // For now, just refresh the profile after any updates
      await refreshProfile()
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Update failed' 
      }
    }
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

// Helper hooks for specific auth states
export function useUser() {
  const { user } = useAuth()
  return user
}

export function useProfile() {
  const { profile } = useAuth()
  return profile
}

export function useIsAuthenticated() {
  const { user, loading } = useAuth()
  return { isAuthenticated: !!user, loading }
}