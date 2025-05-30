'use client'

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface NavigationContextType {
  isNavigating: boolean;
  previousPath: string | null;
}

const NavigationContext = createContext<NavigationContextType>({
  isNavigating: false,
  previousPath: null
});

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [previousPath, setPreviousPath] = useState<string | null>(null);

  useEffect(() => {
    setIsNavigating(true);
    const timeout = setTimeout(() => {
      setIsNavigating(false);
    }, 100);

    return () => {
      clearTimeout(timeout);
      setPreviousPath(pathname);
    };
  }, [pathname]);

  return (
    <NavigationContext.Provider value={{ isNavigating, previousPath }}>
      {children}
    </NavigationContext.Provider>
  );
}

export const useNavigation = () => useContext(NavigationContext); 