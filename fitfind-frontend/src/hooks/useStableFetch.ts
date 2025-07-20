import { useRef, useCallback } from 'react';

// Shallow comparison for dependency arrays
function shallowEqual(a: React.DependencyList, b: React.DependencyList): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function useStableFetch<T extends (...args: any[]) => any>(
  fetchFn: T,
  deps: React.DependencyList
): T {
  const fetchRef = useRef(fetchFn);
  const depsRef = useRef(deps);

  // Update ref when deps change (using shallow comparison instead of JSON.stringify)
  if (!shallowEqual(depsRef.current, deps)) {
    fetchRef.current = fetchFn;
    depsRef.current = deps;
  }

  return useCallback((...args: Parameters<T>) => {
    return fetchRef.current(...args);
  }, []) as T;
} 