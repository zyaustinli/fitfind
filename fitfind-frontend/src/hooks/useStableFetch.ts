import { useRef, useCallback } from 'react';

export function useStableFetch<T extends (...args: any[]) => any>(
  fetchFn: T,
  deps: React.DependencyList
): T {
  const fetchRef = useRef(fetchFn);
  const depsRef = useRef(deps);

  // Update ref when deps change
  if (JSON.stringify(depsRef.current) !== JSON.stringify(deps)) {
    fetchRef.current = fetchFn;
    depsRef.current = deps;
  }

  return useCallback((...args: Parameters<T>) => {
    return fetchRef.current(...args);
  }, []) as T;
} 