import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getProfile as fetchProfileFromApi, updateProfile as updateProfileViaApi } from './api';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export async function signUp(data: SignUpData) {
  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.fullName,
      },
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: authData };
}

export async function signIn(data: SignInData) {
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: authData };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const response = await fetchProfileFromApi();
    if (response.success && response.profile) {
      return response.profile;
    }
    // If the API call fails or there's no profile, return null
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export async function createUserProfile(userId: string, data: Partial<UserProfile>) {
  // Profile creation is now handled by the backend automatically
  // This function is kept for compatibility but just returns success
  // The backend will create the profile when needed via /api/auth/profile
  console.log('Profile creation is handled by the backend automatically');
  return { success: true };
}

export async function updateUserProfile(userId: string, updates: Partial<UserProfile>) {
  try {
    const response = await updateProfileViaApi(updates);
    if (response.success && response.profile) {
      return { success: true, profile: response.profile };
    }
    return { success: false, error: response.error || 'Update failed' };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Update failed' 
    };
  }
}

export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange(callback);
}