import React, { ReactNode, ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Logger } from '../services/logger';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * True React Error Boundary using class component.
 * Catches render errors, lifecycle errors, and constructor errors in child components.
 * Also catches uncaught window errors and unhandled promise rejections.
 */
export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        Logger.error('ErrorBoundary caught a React render error', {
            error: error.toString(),
            componentStack: errorInfo.componentStack || '',
        });
    }

    componentDidMount() {
        window.addEventListener('error', this.handleWindowError);
        window.addEventListener('unhandledrejection', this.handleRejection);
    }

    componentWillUnmount() {
        window.removeEventListener('error', this.handleWindowError);
        window.removeEventListener('unhandledrejection', this.handleRejection);
    }

    private handleWindowError = (event: ErrorEvent) => {
        const error = event.error instanceof Error
            ? event.error
            : new Error(event.message || 'Unknown runtime error');
        Logger.error('ErrorBoundary caught a runtime error', {
            error: error.toString(),
            source: event.filename,
            line: event.lineno,
            column: event.colno,
        });
        this.setState({ hasError: true, error });
    };

    private handleRejection = (event: PromiseRejectionEvent) => {
        const reason = event.reason;
        const error = reason instanceof Error
            ? reason
            : new Error(String(reason || 'Unhandled promise rejection'));
        Logger.error('ErrorBoundary caught an unhandled promise rejection', {
            error: error.toString(),
        });
        this.setState({ hasError: true, error });
    };

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-2xl w-full">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                                <AlertTriangle className="text-red-600 dark:text-red-400" size={32} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Oops! Something went wrong</h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                    We&apos;re sorry for the inconvenience. Please try refreshing the page.
                                </p>
                            </div>
                        </div>

                        {import.meta.env.DEV && this.state.error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                                <h3 className="font-bold text-red-900 dark:text-red-300 mb-2">Error Details:</h3>
                                <p className="text-sm text-red-800 dark:text-red-400 font-mono mb-2">
                                    {this.state.error.toString()}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleRetry}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Refresh Page
                            </button>
                        </div>

                        <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                            <p>If this problem persists, please contact support.</p>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
