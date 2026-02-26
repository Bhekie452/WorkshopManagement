import React, { ReactNode, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Logger } from '../services/logger';

interface Props {
    children: ReactNode;
}

export const ErrorBoundary: React.FC<Props> = ({ children }) => {
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            const nextError = event.error instanceof Error ? event.error : new Error(event.message || 'Unknown runtime error');
            Logger.error('ErrorBoundary caught a runtime error', {
                error: nextError.toString(),
                source: event.filename,
                line: event.lineno,
                column: event.colno,
            });
            setError(nextError);
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const nextError = reason instanceof Error ? reason : new Error(String(reason || 'Unhandled promise rejection'));
            Logger.error('ErrorBoundary caught an unhandled promise rejection', {
                error: nextError.toString(),
            });
            setError(nextError);
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="bg-red-100 p-3 rounded-full">
                            <AlertTriangle className="text-red-600" size={32} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Oops! Something went wrong</h1>
                            <p className="text-gray-600 mt-1">
                                We&apos;re sorry for the inconvenience. Please try refreshing the page.
                            </p>
                        </div>
                    </div>

                    {import.meta.env.DEV && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <h3 className="font-bold text-red-900 mb-2">Error Details:</h3>
                            <p className="text-sm text-red-800 font-mono mb-2">{error.toString()}</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={() => setError(null)}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            Refresh Page
                        </button>
                    </div>

                    <div className="mt-6 text-sm text-gray-500">
                        <p>If this problem persists, please contact support.</p>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
