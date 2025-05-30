'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
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
  })

  // Use ref to track if component is mounted instead of a variable
  const mountedRef = useRef(true)
  const subscriptionRef = useRef<any>(null)
  const initializedRef = useRef(false)

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔵 Auth state changed:', {
      hasUser: !!state.user,
      userEmail: state.user?.email,
      hasProfile: !!state.profile,
      hasSession: !!state.session,
      loading: state.loading,
      initialized: initializedRef.current,
      timestamp: new Date().toISOString()
    });
  }, [state]);

  // Initialize auth state
  useEffect(() => {
    // Prevent re-initialization if already initialized
    if (initializedRef.current) {
      console.log('🔄 AuthProvider already initialized, skipping...');
      return;
    }

    console.log('🚀 AuthProvider initializing...');
    initializedRef.current = true;
    
    async function initializeAuth() {
      try {
        console.log('📡 Getting current session...');
        const session = await getCurrentSession()
        console.log('📡 Current session:', session ? 'exists' : 'null');
        
        if (mountedRef.current) {
          if (session?.user) {
            console.log('👤 User found, getting profile...');
            // Get user profile with retry logic
            let profile = await getUserProfile(session.user.id)
            
            // If no profile exists, try to create one
            if (!profile && session.user.email) {
              console.log('No profile found, creating one...')
              const result = await createUserProfile(session.user)
              if (result.success) {
                profile = result.profile || null
                console.log('Profile created successfully')
              } else {
                console.error('Failed to create profile:', result.error)
              }
            }

            console.log('✅ Setting authenticated state');
            setState({
              user: session.user,
              profile,
              session,
              loading: false
            })
          } else {
            console.log('❌ No user session, setting unauthenticated state');
            setState({
              user: null,
              profile: null,
              session: null,
              loading: false
            })
          }
        } else {
          console.log('⚠️ Component unmounted during auth initialization');
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error)
        if (mountedRef.current) {
          setState({
            user: null,
            profile: null,
            session: null,
            loading: false
          })
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    console.log('👂 Setting up auth state change listener...');
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) {
        console.log('⚠️ Auth state change ignored - component unmounted');
        return;
      }

      console.log('🔄 Auth state change event:', event, session?.user?.email || 'no user');

      if (session?.user) {
        console.log('👤 User session detected, updating state...');
        // Only set loading if we don't already have this user and we're not already loading
        setState(prev => {
          if (prev.user?.id !== session.user.id && !prev.loading) {
            console.log('🔄 Setting loading state for new user');
            return { ...prev, loading: true };
          }
          console.log('🔄 Keeping current state, no loading needed');
          return prev;
        });
        
        try {
          // Get user profile with retry for new signups
          let profile = await getUserProfile(session.user.id)
          
          // Create profile if it doesn't exist
          if (!profile && session.user.email) {
            console.log(`Creating profile for ${event} event...`)
            const result = await createUserProfile(session.user)
            if (result.success) {
              profile = result.profile || null
              console.log('Profile created in auth state change')
            } else {
              console.error('Failed to create profile in auth state change:', result.error)
            }
          }

          // For sign-in events, if still no profile, try one more time after a brief delay
          if (!profile && event === 'SIGNED_IN' && session.user.email) {
            console.log('Retrying profile fetch after sign-in...')
            await new Promise(resolve => setTimeout(resolve, 1000))
            profile = await getUserProfile(session.user.id)
          }

          if (mountedRef.current) {
            console.log('✅ Setting authenticated state from auth change');
            setState({
              user: session.user,
              profile,
              session,
              loading: false
            })
          } else {
            console.log('⚠️ Component unmounted during auth state change handling');
          }
        } catch (error) {
          console.error('Error handling auth state change:', error)
          if (mountedRef.current) {
            setState({
              user: session.user,
              profile: null,
              session,
              loading: false
            })
          }
        }
      } else {
        console.log('❌ No user session, clearing auth state');
        if (mountedRef.current) {
          setState({
            user: null,
            profile: null,
            session: null,
            loading: false
          })
        }
      }
    })

    subscriptionRef.current = subscription

    return () => {
      console.log('🧹 AuthProvider cleanup - unmounting');
      mountedRef.current = false
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, []) // No dependencies to prevent re-running

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 AuthProvider final cleanup');
      mountedRef.current = false
    }
  }, [])

  const signUp = async (data: SignUpData) => {
    setState(prev => ({ ...prev, loading: true }))
    
    try {
      const result = await authSignUp(data)
      
      if (result.success && result.user) {
        console.log('Signup successful, user created:', result.user.email)
        
        // For confirmed users (no email verification needed), immediately try to create profile
        if (result.user.email_confirmed_at) {
          console.log('User email confirmed, creating profile immediately...')
          const profileResult = await createUserProfile(result.user)
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
      const { updateUserProfile } = await import('@/lib/auth')
      const result = await updateUserProfile(state.user.id, updates)
      
      if (result.success && result.profile) {
        setState(prev => ({ ...prev, profile: result.profile || prev.profile }))
      }
      
      return result
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