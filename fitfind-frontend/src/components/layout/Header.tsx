'use client'

import { useState } from 'react'
import { Sparkles, Menu, X, Heart, History, LogOut, Settings, Search, FolderHeart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthModal } from '@/components/auth/AuthModal'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface HeaderProps {
  className?: string
}

export function Header({ className }: HeaderProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const { user, profile, loading, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    setIsUserMenuOpen(false)
  }

  const openAuthModal = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode)
    setIsAuthModalOpen(true)
    setIsMobileMenuOpen(false)
  }

  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(name => name[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (user?.email) {
      return user.email[0].toUpperCase()
    }
    return 'U'
  }

  return (
    <>
      <header className={cn(
        "sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                FitFind
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <Link 
                href="/" 
                className="flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
              </Link>
              <Link 
                href="/history" 
                className="flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="h-4 w-4" />
                <span>History</span>
              </Link>
              <Link 
                href="/collections" 
                className="flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <FolderHeart className="h-4 w-4" />
                <span>Collections</span>
              </Link>
              <Link 
                href="/wishlist" 
                className="flex items-center space-x-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Heart className="h-4 w-4" />
                <span>Wishlist</span>
              </Link>
            </nav>

            {/* User Menu / Auth Buttons */}
            <div className="flex items-center space-x-4">
              {loading ? (
                <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
              ) : user ? (
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 rounded-full bg-primary text-primary-foreground p-2 hover:bg-primary/90 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium">
                      {getUserInitials()}
                    </div>
                  </button>

                  {/* User Dropdown Menu */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-background border rounded-lg shadow-lg py-1 z-50">
                      <div className="px-3 py-2 border-b">
                        <p className="text-sm font-medium">{profile?.full_name || 'User'}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      
                      <Link 
                        href="/profile" 
                        className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                      
                      <Link 
                        href="/history" 
                        className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-muted transition-colors md:hidden"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <History className="h-4 w-4" />
                        <span>History</span>
                      </Link>
                      
                      <Link 
                        href="/collections" 
                        className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-muted transition-colors md:hidden"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <FolderHeart className="h-4 w-4" />
                        <span>Collections</span>
                      </Link>
                      
                      <Link 
                        href="/wishlist" 
                        className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-muted transition-colors md:hidden"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Heart className="h-4 w-4" />
                        <span>Wishlist</span>
                      </Link>
                      
                      <button
                        onClick={handleSignOut}
                        className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-muted transition-colors w-full text-left"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden md:flex items-center space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openAuthModal('login')}
                  >
                    Sign In
                  </Button>
                  <Link href="/signup">
                    <Button size="sm">
                      Sign Up
                    </Button>
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-muted-foreground hover:text-foreground"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t py-4">
              <nav className="space-y-2">
                <Link 
                  href="/"
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Search className="h-4 w-4" />
                  <span>Search</span>
                </Link>
                <Link 
                  href="/history"
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <History className="h-4 w-4" />
                  <span>History</span>
                </Link>
                <Link 
                  href="/collections"
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <FolderHeart className="h-4 w-4" />
                  <span>Collections</span>
                </Link>
                <Link 
                  href="/wishlist"
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Heart className="h-4 w-4" />
                  <span>Wishlist</span>
                </Link>
                
                {!user && (
                  <div className="border-t pt-2 mt-2">
                    <div className="space-y-2 px-3">
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start"
                        onClick={() => openAuthModal('login')}
                      >
                        Sign In
                      </Button>
                      <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button className="w-full justify-start">
                          Sign Up
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Click outside to close menus */}
      {(isUserMenuOpen || isMobileMenuOpen) && (
        <div 
          className="fixed inset-0 z-30" 
          onClick={() => {
            setIsUserMenuOpen(false)
            setIsMobileMenuOpen(false)
          }} 
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        defaultMode={authModalMode}
      />
    </>
  )
} 