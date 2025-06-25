'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { LoginForm } from './LoginForm'
import { SignupForm } from './SignupForm'
import { ForgotPasswordForm } from './ForgotPasswordForm'

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultMode?: 'login' | 'signup'
}

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'success'

export function AuthModal({ open, onOpenChange, defaultMode = 'login' }: AuthModalProps) {
  const [internalMode, setInternalMode] = useState<'forgot-password' | 'success' | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  
  // Use defaultMode for login/signup, internal state for forgot-password/success
  const mode: AuthMode = internalMode || defaultMode

  const handleClose = () => {
    onOpenChange(false)
    // Reset internal state when closing
    setTimeout(() => {
      setInternalMode(null)
      setSuccessMessage('')
    }, 300)
  }

  const handleAuthSuccess = (message?: string) => {
    if (defaultMode === 'signup') {
      setSuccessMessage(message || 'Account created successfully! Please check your email to verify your account.')
      setInternalMode('success')
    } else {
      handleClose()
    }
  }

  const handleForgotPasswordSuccess = () => {
    setSuccessMessage('Password reset email sent! Please check your inbox.')
    setInternalMode('success')
  }

  const getTitle = () => {
    switch (mode) {
      case 'login':
        return 'Welcome back'
      case 'signup':
        return 'Create your account'
      case 'forgot-password':
        return 'Reset your password'
      case 'success':
        return 'Success!'
      default:
        return 'Authentication'
    }
  }

  const getDescription = () => {
    switch (mode) {
      case 'login':
        return 'Sign in to your FitFind account to save your searches and create wishlists'
      case 'signup':
        return 'Join FitFind to save your favorite outfits and get personalized recommendations'
      case 'forgot-password':
        return 'Enter your email address and we\'ll send you a link to reset your password'
      case 'success':
        return successMessage
      default:
        return ''
    }
  }

  const renderContent = () => {
    switch (mode) {
      case 'login':
        return (
          <LoginForm
            onSuccess={() => handleAuthSuccess()}
            onSwitchToSignup={() => setInternalMode(null)}
            onForgotPassword={() => setInternalMode('forgot-password')}
          />
        )
      case 'signup':
        return (
          <SignupForm
            onSuccess={() => handleAuthSuccess()}
            onSwitchToLogin={() => setInternalMode(null)}
          />
        )
      case 'forgot-password':
        return (
          <ForgotPasswordForm
            onSuccess={handleForgotPasswordSuccess}
            onBackToLogin={() => setInternalMode(null)}
          />
        )
      case 'success':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleClose}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 rounded-lg font-medium transition-colors"
              >
                Continue
              </button>
              {mode === 'success' && successMessage.includes('verify') && (
                <button
                  onClick={() => setInternalMode(null)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Already verified? Sign in
                </button>
              )}
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogClose onClick={handleClose} />
        
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-[#6b7f3a] rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-[#6b7f3a] bg-clip-text text-transparent">
                FitFind
              </span>
            </div>
          </div>
          
          <DialogTitle className="text-center text-2xl">
            {getTitle()}
          </DialogTitle>
          
          <DialogDescription className="text-center">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
} 