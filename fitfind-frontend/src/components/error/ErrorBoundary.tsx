"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showReportButton?: boolean;
  context?: string; // Context where the error occurred (e.g., "History Page", "Collections")
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate a unique error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Error Boundary caught error:', {
      error,
      errorInfo,
      context: this.props.context,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    });

    this.setState({
      error,
      errorInfo
    });

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);

    // Report error to monitoring service (if available)
    this.reportError(error, errorInfo);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // This is where you'd integrate with error reporting services
    // like Sentry, LogRocket, or your own error tracking
    
    const errorReport = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context: this.props.context,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    };

    // For now, just log to console
    console.error('📊 Error Report:', errorReport);

    // TODO: Send to error reporting service
    // Example: Sentry.captureException(error, { extra: errorReport });
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`🔄 Retrying... (${this.retryCount}/${this.maxRetries})`);
      
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null
      });
    } else {
      console.warn('⚠️ Max retries reached, manual refresh required');
    }
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  private copyErrorDetails = () => {
    const errorDetails = {
      errorId: this.state.errorId,
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      context: this.props.context,
      timestamp: new Date().toISOString()
    };

    const errorText = JSON.stringify(errorDetails, null, 2);
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(errorText).then(() => {
        console.log('📋 Error details copied to clipboard');
      });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = errorText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      console.log('📋 Error details copied to clipboard (fallback)');
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.retryCount < this.maxRetries;
      const errorMessage = this.state.error?.message || 'An unexpected error occurred';
      const isNetworkError = errorMessage.toLowerCase().includes('network') || 
                           errorMessage.toLowerCase().includes('fetch');

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-2xl mx-auto">
            {/* Error Icon */}
            <div className="mb-8">
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl"></div>
                <div className="relative w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
                  <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
              </div>
            </div>

            {/* Error Message */}
            <h2 className="text-2xl font-bold text-foreground mb-4">
              {this.props.context ? `${this.props.context} Error` : 'Something went wrong'}
            </h2>
            
            <p className="text-muted-foreground mb-2 leading-relaxed">
              {isNetworkError 
                ? "We're having trouble connecting to our servers. Please check your internet connection and try again."
                : "An unexpected error occurred while loading this section. Our team has been notified."
              }
            </p>

            {this.state.errorId && (
              <p className="text-sm text-muted-foreground mb-8">
                Error ID: <code className="bg-muted px-2 py-1 rounded text-xs">{this.state.errorId}</code>
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              {canRetry && (
                <Button 
                  onClick={this.handleRetry}
                  className="gap-2 min-w-[140px]"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again ({this.maxRetries - this.retryCount} left)
                </Button>
              )}
              
              <Button 
                variant="outline" 
                onClick={this.handleReload}
                className="gap-2 min-w-[140px]"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </Button>
              
              <Button 
                variant="outline" 
                onClick={this.handleGoHome}
                className="gap-2 min-w-[140px]"
              >
                <Home className="w-4 h-4" />
                Go Home
              </Button>
            </div>

            {/* Developer Tools */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 p-4 bg-muted/30 rounded-lg border border-border/50">
                <h3 className="text-sm font-medium text-foreground mb-2">Debug Information</h3>
                <div className="text-xs text-muted-foreground space-y-1 text-left">
                  <div><strong>Error:</strong> {this.state.error?.message}</div>
                  <div><strong>Context:</strong> {this.props.context || 'Unknown'}</div>
                  {this.state.error?.stack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer hover:text-foreground">Stack Trace</summary>
                      <pre className="mt-2 p-2 bg-background rounded text-xs overflow-auto max-h-40">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={this.copyErrorDetails}
                  className="gap-2 mt-3"
                >
                  <Bug className="w-3 h-3" />
                  Copy Error Details
                </Button>
              </div>
            )}

            {/* Report Button */}
            {this.props.showReportButton && (
              <div className="mt-6">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={this.copyErrorDetails}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Bug className="w-4 h-4" />
                  Report This Issue
                </Button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Convenience wrapper for page-level error boundaries
export const PageErrorBoundary: React.FC<{ children: ReactNode; pageName: string }> = ({ 
  children, 
  pageName 
}) => (
  <ErrorBoundary 
    context={pageName}
    showReportButton={true}
    onError={(error, errorInfo) => {
      console.error(`📄 ${pageName} page error:`, { error, errorInfo });
    }}
  >
    {children}
  </ErrorBoundary>
);

// Hook for handling async errors in components
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((error: Error) => {
    console.error('🔴 Async error handled:', error);
    setError(error);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  // Throw error to be caught by error boundary
  if (error) {
    throw error;
  }

  return { handleError, clearError };
};

export default ErrorBoundary;