"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  Plus,
  History, 
  Heart, 
  User, 
  Settings,
  Menu,
  X,
  LogIn,
  LogOut,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";

const navigation = [
  { name: "Upload Image", href: "/", icon: Plus },
  { name: "History", href: "/history", icon: History },
  { name: "Wishlist", href: "/wishlist", icon: Heart },
];

export function Sidebar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const pathname = usePathname();
  const { user, profile, loading, signOut } = useAuth();

  // Debug logging for auth state in sidebar
  useEffect(() => {
    console.log('🔷 Sidebar auth state:', {
      hasUser: !!user,
      userEmail: user?.email,
      loading,
      mounted,
      timestamp: new Date().toISOString()
    });
  }, [user, loading, mounted]);

  useEffect(() => {
    console.log('🔷 Sidebar mounting...');
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
  };

  const openAuthModal = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
    setMobileMenuOpen(false);
  };

  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(name => name[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-card border border-border shadow-sm"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-20 bg-card border-r border-border transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center p-4 border-b border-border">
            <Link href="/" className="block">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-[#6b7f3a] rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = mounted && pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  title={item.name}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-border space-y-2">
            {loading ? (
              <div className="flex justify-center">
                <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
              </div>
            ) : user ? (
              <>
                {/* Profile */}
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex justify-center"
                  title={profile?.full_name || user.email || 'Profile'}
                >
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-medium">
                    {getUserInitials()}
                  </div>
                </Link>
                
                {/* Settings */}
                <Link
                  href="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center w-12 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Link>
                
                {/* Sign Out */}
                <button
                  onClick={handleSignOut}
                  className="flex items-center justify-center w-12 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                {/* Sign In */}
                <button
                  onClick={() => openAuthModal('login')}
                  className="flex items-center justify-center w-12 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Sign In"
                >
                  <LogIn className="h-4 w-4" />
                </button>
                
                {/* Sign Up */}
                <button
                  onClick={() => openAuthModal('signup')}
                  className="flex items-center justify-center w-12 h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  title="Sign Up"
                >
                  <User className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        defaultMode={authModalMode}
      />
    </>
  );
} 