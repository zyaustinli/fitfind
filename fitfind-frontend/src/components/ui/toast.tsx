"use client";

import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { X, CheckCircle, AlertCircle, Info, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
}

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: "success" | "error" | "info" | "warning";
  duration?: number;
  action?: ToastAction;
  persistent?: boolean; // For critical actions that shouldn't auto-dismiss
  priority?: "low" | "normal" | "high"; // For toast ordering
}

interface ToastContextType {
  toasts: Toast[];
  toast: (toast: Omit<Toast, "id">) => string; // Return toast ID for manual dismissal
  dismiss: (id: string) => void;
  dismissAll: () => void;
  updateToast: (id: string, updates: Partial<Toast>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dismissTimers, setDismissTimers] = useState<Map<string, NodeJS.Timeout>>(new Map());

  const toast = useCallback((newToast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toastWithId = { 
      ...newToast, 
      id,
      priority: newToast.priority || "normal",
      duration: newToast.duration ?? (newToast.persistent ? undefined : 5000)
    };

    setToasts(prev => {
      // Sort by priority (high -> normal -> low)
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const newToasts = [...prev, toastWithId].sort((a, b) => 
        priorityOrder[b.priority || "normal"] - priorityOrder[a.priority || "normal"]
      );
      
      // Limit to 5 toasts max
      return newToasts.slice(0, 5);
    });

    // Auto dismiss after duration (if not persistent)
    if (!newToast.persistent && toastWithId.duration) {
      const timer = setTimeout(() => {
        dismiss(id);
      }, toastWithId.duration);
      
      setDismissTimers(prev => {
        const newTimers = new Map(prev);
        newTimers.set(id, timer);
        return newTimers;
      });
    }

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    
    // Clear timer if exists
    setDismissTimers(prev => {
      const newTimers = new Map(prev);
      const timer = newTimers.get(id);
      if (timer) {
        clearTimeout(timer);
        newTimers.delete(id);
      }
      return newTimers;
    });
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
    
    // Clear all timers
    setDismissTimers(prev => {
      prev.forEach(timer => clearTimeout(timer));
      return new Map();
    });
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts(prev => 
      prev.map(toast => 
        toast.id === id ? { ...toast, ...updates } : toast
      )
    );
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      dismissTimers.forEach(timer => clearTimeout(timer));
    };
  }, [dismissTimers]);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss, dismissAll, updateToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Helper hook for deletion operations with undo
export function useDeleteToast() {
  const { toast } = useToast();

  const showDeleteToast = useCallback((
    itemName: string,
    onUndo: () => void,
    options?: {
      description?: string;
      undoTimeout?: number;
    }
  ) => {
    return toast({
      type: "success",
      title: `${itemName} deleted`,
      description: options?.description || "The item has been removed from your history.",
      duration: options?.undoTimeout || 8000,
      action: {
        label: "Undo",
        onClick: onUndo,
        variant: "outline"
      },
      priority: "high"
    });
  }, [toast]);

  return { showDeleteToast };
}

function ToastContainer({ 
  toasts, 
  onDismiss 
}: { 
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((toast, index) => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onDismiss={onDismiss}
          index={index}
        />
      ))}
    </div>
  );
}

function ToastItem({ 
  toast, 
  onDismiss,
  index 
}: { 
  toast: Toast;
  onDismiss: (id: string) => void;
  index: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Staggered entrance animation
    const delay = index * 100;
    const timer = setTimeout(() => setIsVisible(true), delay + 10);
    return () => clearTimeout(timer);
  }, [index]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  const handleActionClick = () => {
    if (toast.action?.onClick) {
      toast.action.onClick();
      handleDismiss();
    }
  };

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    warning: AlertCircle
  };

  const Icon = icons[toast.type];

  const colorClasses = {
    success: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200",
    error: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200",
    info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200"
  };

  const iconColorClasses = {
    success: "text-green-500",
    error: "text-red-500",
    info: "text-blue-500",
    warning: "text-yellow-500"
  };

  const priorityEffects = {
    high: "ring-2 ring-primary/20 shadow-xl",
    normal: "shadow-lg",
    low: "shadow-md"
  };

  return (
    <div
      className={cn(
        "w-full p-4 rounded-lg border transition-all duration-300 transform",
        colorClasses[toast.type],
        priorityEffects[toast.priority || "normal"],
        isVisible && !isExiting 
          ? "translate-x-0 opacity-100 scale-100" 
          : "translate-x-full opacity-0 scale-95",
        isExiting && "-translate-x-full opacity-0 scale-95"
      )}
      style={{
        transitionDelay: isVisible ? `${index * 50}ms` : '0ms'
      }}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", iconColorClasses[toast.type])} />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{toast.title}</h4>
          {toast.description && (
            <p className="text-sm opacity-90 mt-1 leading-relaxed">{toast.description}</p>
          )}
          
          {/* Action button */}
          {toast.action && (
            <div className="mt-3">
              <Button
                variant={toast.action.variant || "outline"}
                size="sm"
                onClick={handleActionClick}
                className="h-8 px-3 text-xs font-medium bg-white/80 hover:bg-white border-current/20 hover:border-current/40 text-current"
              >
                {toast.action.label === "Undo" && <Undo2 className="w-3 h-3 mr-1" />}
                {toast.action.label}
              </Button>
            </div>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="p-1 h-auto text-current hover:bg-current/10 transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
} 