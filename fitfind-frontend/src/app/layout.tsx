import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { ToastProvider } from "@/components/ui/toast";
import { Sidebar } from "@/components/layout/sidebar";

export const metadata: Metadata = {
  title: "FitFind - Fashion Discovery",
  description: "Upload your outfit photos and discover similar clothing with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased" suppressHydrationWarning={true}>
        <ToastProvider>
          <AuthProvider>
            <NavigationProvider>
              <div className="flex h-screen bg-background">
                <Sidebar />
                <main className="flex-1 overflow-hidden">
                  {children}
                </main>
              </div>
            </NavigationProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
