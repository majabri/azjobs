'use client';

import React, { ReactNode, ErrorInfo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ServiceHealthGuardProps {
  children: ReactNode;
  serviceName: string;
  fallbackUI?: ReactNode;
}

interface ServiceHealthGuardState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export default class ServiceHealthGuard extends React.Component<
  ServiceHealthGuardProps,
  ServiceHealthGuardState
> {
  constructor(props: ServiceHealthGuardProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      hasError: true,
      error,
      errorInfo,
      retryCount: 0
    });

    // Log error to platform_events table
    this.logErrorToDatabase(error, errorInfo);
  }

  private logErrorToDatabase = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase
        .from('platform_events')
        .insert({
          event_type: 'service_error',
          service_name: this.props.serviceName,
          severity: 'high',
          message: error.toString(),
          context: {
            serviceName: this.props.serviceName,
            errorMessage: error.message,
            errorStack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
            userId: user?.id
          },
          status: 'open'
        });
    } catch (err) {
      // Silently fail - don't let logging errors break the app
      console.error('Failed to log error to database:', err);
    }
  };

  private handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      const {
        error,
        errorInfo,
        retryCount
      } = this.state;

      const defaultFallback = (
        <Card className="bg-card border-border m-4">
          <div className="p-8">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  {this.props.serviceName} Service Error
                </h2>
                <p className="text-muted-foreground mb-4">
                  We encountered an error in the {this.props.serviceName} service.
                  Our team has been notified and is working on a fix.
                </p>

                {process.env.NODE_ENV === 'development' && (
                  <details className="mb-4 p-3 bg-muted rounded text-xs text-muted-foreground/70 font-mono">
                    <summary className="cursor-pointer font-semibold mb-2">
                      Error Details (Development Only)
                    </summary>
                    <div className="space-y-2">
                      {error && (
                        <div>
                          <strong>Error:</strong> {error.toString()}
                        </div>
                      )}
                      {errorInfo && (
                        <div>
                          <strong>Component Stack:</strong>
                          <pre className="mt-1 overflow-auto max-h-32">
                            {errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={this.handleRetry}
                    className="bg-primary hover:bg-primary/90 text-foreground"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try Again
                    {retryCount > 0 && ` (${retryCount})`}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-border text-muted-foreground hover:bg-muted"
                    onClick={() => window.location.href = '/'}
                  >
                    Back to Home
                  </Button>
                </div>

                {retryCount >= 3 && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Still having issues? Please contact{' '}
                    <a
                      href="mailto:support@icareer.os"
                      className="text-primary hover:text-indigo-300"
                    >
                      support@icareer.os
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      );

      return this.props.fallbackUI || defaultFallback;
    }

    return this.props.children;
  }
}
