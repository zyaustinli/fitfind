"use client";

import { useState } from "react";
import { Sparkles, Heart, Search, History, Star, CheckCircle, ImageIcon, Upload } from "lucide-react";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function SignUpPage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('signup');
  const { user } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  if (user) {
    return null; // Don't render anything while redirecting
  }

  const features = [
    {
      icon: Heart,
      title: "Save to Wishlist",
      description: "Keep track of your favorite fashion finds and never lose that perfect item again.",
      color: "text-red-500"
    },
    {
      icon: History,
      title: "Search History",
      description: "Access all your previous searches and discover new items from past outfits.",
      color: "text-blue-500"
    },
    {
      icon: Star,
      title: "Personalized Recommendations",
      description: "Get better recommendations as our AI learns your style preferences over time.",
      color: "text-yellow-500"
    },
    {
      icon: CheckCircle,
      title: "Premium Features",
      description: "Unlock advanced search filters, price alerts, and exclusive retailer partnerships.",
      color: "text-green-500"
    }
  ];

  const testimonials = [
    {
      name: "Sarah M.",
      text: "FitFind helped me recreate my favorite celebrity looks on a budget!",
      rating: 5
    },
    {
      name: "Alex K.",
      text: "The AI is incredibly accurate at finding similar items. Love it!",
      rating: 5
    },
    {
      name: "Emma L.",
      text: "Finally found a way to shop more sustainably by finding exact matches.",
      rating: 5
    }
  ];

  return (
    <>
      <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center py-16 px-4">
            <div className="mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-[#6b7f3a] rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
                Join <span className="bg-gradient-to-r from-primary to-[#6b7f3a] bg-clip-text text-transparent">FitFind</span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Discover your perfect style with AI-powered fashion search. Upload any outfit photo and find similar items from top retailers worldwide.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <Button 
                size="lg" 
                className="px-8 py-3 text-lg bg-gradient-to-r from-primary to-[#6b7f3a] hover:from-primary/90 hover:to-[#6b7f3a]/90"
                onClick={() => {
                  setAuthModalMode('signup');
                  setIsAuthModalOpen(true);
                }}
              >
                Get Started Free
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="px-8 py-3 text-lg"
                onClick={() => {
                  setAuthModalMode('login');
                  setIsAuthModalOpen(true);
                }}
              >
                Sign In
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Already have an account? {" "}
              <button 
                onClick={() => {
                  setAuthModalMode('login');
                  setIsAuthModalOpen(true);
                }}
                className="text-primary hover:underline font-medium"
              >
                Sign in here
              </button>
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 px-4 mb-16">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-6 rounded-2xl bg-background border hover:shadow-lg transition-all duration-300">
                <div className="mb-4">
                  <feature.icon className={`h-12 w-12 ${feature.color} mx-auto`} />
                </div>
                <h3 className="text-lg font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* How It Works */}
          <div className="text-center px-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg mb-12 max-w-2xl mx-auto">
              Get personalized fashion recommendations in three simple steps
            </p>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">1. Upload</h3>
                <p className="text-muted-foreground">Upload any outfit photo from your device or social media</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">2. Analyze</h3>
                <p className="text-muted-foreground">Our AI identifies clothing items and style elements</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">3. Discover</h3>
                <p className="text-muted-foreground">Get similar items from top retailers at various price points</p>
              </div>
            </div>
          </div>

          {/* Testimonials */}
          <div className="px-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">What Our Users Say</h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="bg-background border rounded-2xl p-6 text-center">
                  <div className="flex justify-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-500 fill-current" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4 italic">"{testimonial.text}"</p>
                  <p className="font-semibold">{testimonial.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center px-4 py-16 bg-gradient-to-r from-primary/5 to-[#6b7f3a]/5 rounded-3xl mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Find Your Style?</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of fashion enthusiasts who use FitFind to discover their perfect style
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                className="px-8 py-3 text-lg bg-gradient-to-r from-primary to-[#6b7f3a] hover:from-primary/90 hover:to-[#6b7f3a]/90"
                onClick={() => {
                  setAuthModalMode('signup');
                  setIsAuthModalOpen(true);
                }}
              >
                Start Free Today
              </Button>
              <Link href="/">
                <Button variant="outline" size="lg" className="px-8 py-3 text-lg">
                  Try Without Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        defaultMode={authModalMode}
      />
    </>
  );
} 