import { useState, useEffect, useRef, useCallback } from 'react';

interface QueuedOperation {
  id: string;
  operation: () => Promise<any>;
  retryCount: number;
  maxRetries: number;
  timestamp: number;
  description: string;
}

interface NetworkState {
  isOnline: boolean;
  isSlowConnection: boolean;
  lastOnlineTime: number | null;
  lastOfflineTime: number | null;
}

interface UseNetworkOptions {
  maxRetries?: number;
  retryDelay?: number;
  slowConnectionThreshold?: number; // in ms
}

export function useNetwork(options: UseNetworkOptions = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    slowConnectionThreshold = 2000
  } = options;

  const [networkState, setNetworkState] = useState<NetworkState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSlowConnection: false,
    lastOnlineTime: null,
    lastOfflineTime: null
  });

  const [queuedOperations, setQueuedOperations] = useState<QueuedOperation[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTestRef = useRef<AbortController | null>(null);

  // Test connection speed
  const testConnectionSpeed = useCallback(async (): Promise<boolean> => {
    if (!networkState.isOnline) return false;

    try {
      const startTime = Date.now();
      
      // Cancel previous test
      if (connectionTestRef.current) {
        connectionTestRef.current.abort();
      }
      
      connectionTestRef.current = new AbortController();
      
      // Simple connection test - try to fetch a small resource
      await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: connectionTestRef.current.signal
      });
      
      const duration = Date.now() - startTime;
      const isSlowConnection = duration > slowConnectionThreshold;
      
      setNetworkState(prev => ({
        ...prev,
        isSlowConnection
      }));
      
      return !isSlowConnection;
    } catch (error) {
      // If test fails, assume slow/no connection
      setNetworkState(prev => ({
        ...prev,
        isSlowConnection: true
      }));
      return false;
    }
  }, [networkState.isOnline, slowConnectionThreshold]);

  // Queue operation for retry when offline
  const queueOperation = useCallback((
    operation: () => Promise<any>,
    description: string,
    customMaxRetries?: number
  ): string => {
    const id = `operation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedOp: QueuedOperation = {
      id,
      operation,
      retryCount: 0,
      maxRetries: customMaxRetries ?? maxRetries,
      timestamp: Date.now(),
      description
    };

    setQueuedOperations(prev => [...prev, queuedOp]);
    return id;
  }, [maxRetries]);

  // Execute operation with retry logic
  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    description: string = 'Operation',
    options?: {
      maxRetries?: number;
      queueWhenOffline?: boolean;
      showToast?: boolean;
    }
  ): Promise<{ success: boolean; data?: T; error?: string; queued?: boolean }> => {
    const {
      maxRetries: customMaxRetries = maxRetries,
      queueWhenOffline = true,
      showToast = false
    } = options || {};

    // If offline and queuing is enabled, queue the operation
    if (!networkState.isOnline && queueWhenOffline) {
      const operationId = queueOperation(operation, description, customMaxRetries);
      return {
        success: false,
        error: 'Operation queued for when connection is restored',
        queued: true
      };
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= customMaxRetries; attempt++) {
      try {
        const result = await operation();
        return { success: true, data: result };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on certain errors (like 401, 403, 404)
        if (error instanceof Error && 'status' in error) {
          const status = (error as any).status;
          if ([401, 403, 404, 422].includes(status)) {
            break;
          }
        }

        // Wait before retry (exponential backoff)
        if (attempt < customMaxRetries) {
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Operation failed after all retries'
    };
  }, [networkState.isOnline, maxRetries, retryDelay, queueOperation]);

  // Process queued operations
  const processQueue = useCallback(async () => {
    if (isProcessingQueue || queuedOperations.length === 0 || !networkState.isOnline) {
      return;
    }

    setIsProcessingQueue(true);

    const operations = [...queuedOperations];
    const succeededIds: string[] = [];
    const failedOperations: QueuedOperation[] = [];

    for (const op of operations) {
      try {
        await op.operation();
        succeededIds.push(op.id);
        console.log(`✅ Queued operation succeeded: ${op.description}`);
      } catch (error) {
        const updatedOp = {
          ...op,
          retryCount: op.retryCount + 1
        };

        if (updatedOp.retryCount < updatedOp.maxRetries) {
          failedOperations.push(updatedOp);
          console.log(`⚠️ Queued operation failed, will retry: ${op.description}`);
        } else {
          console.error(`❌ Queued operation failed permanently: ${op.description}`, error);
        }
      }
    }

    // Update queue - remove succeeded operations, keep failed ones for retry
    setQueuedOperations(prev => [
      ...prev.filter(op => !succeededIds.includes(op.id) && !operations.some(o => o.id === op.id)),
      ...failedOperations
    ]);

    setIsProcessingQueue(false);
  }, [isProcessingQueue, queuedOperations, networkState.isOnline]);

  // Clear queue
  const clearQueue = useCallback(() => {
    setQueuedOperations([]);
  }, []);

  // Remove specific operation from queue
  const removeFromQueue = useCallback((operationId: string) => {
    setQueuedOperations(prev => prev.filter(op => op.id !== operationId));
  }, []);

  // Handle online/offline events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setNetworkState(prev => ({
        ...prev,
        isOnline: true,
        lastOnlineTime: Date.now()
      }));
      
      // Test connection speed when coming online
      testConnectionSpeed();
    };

    const handleOffline = () => {
      setNetworkState(prev => ({
        ...prev,
        isOnline: false,
        lastOfflineTime: Date.now()
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (connectionTestRef.current) {
        connectionTestRef.current.abort();
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [testConnectionSpeed]);

  // Process queue when coming online
  useEffect(() => {
    if (networkState.isOnline && queuedOperations.length > 0) {
      // Delay processing to allow connection to stabilize
      retryTimeoutRef.current = setTimeout(() => {
        processQueue();
      }, 1000);
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [networkState.isOnline, queuedOperations.length, processQueue]);

  // Periodic connection speed test
  useEffect(() => {
    if (!networkState.isOnline) return;

    const interval = setInterval(() => {
      testConnectionSpeed();
    }, 30000); // Test every 30 seconds

    return () => clearInterval(interval);
  }, [networkState.isOnline, testConnectionSpeed]);

  return {
    // State
    isOnline: networkState.isOnline,
    isSlowConnection: networkState.isSlowConnection,
    queuedOperationsCount: queuedOperations.length,
    isProcessingQueue,
    
    // Actions
    executeWithRetry,
    queueOperation,
    processQueue,
    clearQueue,
    removeFromQueue,
    testConnectionSpeed,
    
    // Queue info
    queuedOperations: queuedOperations.map(op => ({
      id: op.id,
      description: op.description,
      retryCount: op.retryCount,
      maxRetries: op.maxRetries,
      timestamp: op.timestamp
    }))
  };
} 