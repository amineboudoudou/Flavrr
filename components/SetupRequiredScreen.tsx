import React from 'react';
import { validateEnv, getEnvExample } from '../lib/env';

interface SetupRequiredScreenProps {
    error?: string;
}

export const SetupRequiredScreen: React.FC<SetupRequiredScreenProps> = ({ error }) => {
    const validation = validateEnv();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-6">
            <div className="max-w-2xl w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                            className="w-8 h-8 text-red-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Setup Required</h1>
                    <p className="text-white/60">
                        The application is missing required configuration
                    </p>
                </div>

                {/* Error Details */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
                        <p className="text-red-400 text-sm font-mono">{error}</p>
                    </div>
                )}

                {/* Missing Variables */}
                {validation.missingVars.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-white font-semibold mb-3">Missing Environment Variables:</h2>
                        <ul className="space-y-2">
                            {validation.missingVars.map((varName) => (
                                <li
                                    key={varName}
                                    className="bg-white/5 border border-white/10 rounded-lg p-3 font-mono text-sm text-white/80"
                                >
                                    {varName}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Invalid Variables */}
                {validation.invalidVars.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-white font-semibold mb-3">Invalid Environment Variables:</h2>
                        <ul className="space-y-2">
                            {validation.invalidVars.map(({ name, reason }) => (
                                <li
                                    key={name}
                                    className="bg-white/5 border border-white/10 rounded-lg p-3"
                                >
                                    <p className="font-mono text-sm text-white/80">{name}</p>
                                    <p className="text-red-400 text-xs mt-1">{reason}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Setup Instructions */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
                    <h2 className="text-white font-semibold mb-3">Setup Instructions:</h2>
                    <ol className="space-y-3 text-white/70 text-sm">
                        <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-primary/20 text-primary rounded-full flex items-center justify-center text-xs font-bold">
                                1
                            </span>
                            <span>
                                Create a file named <code className="bg-black/40 px-2 py-1 rounded text-xs">.env.local</code> in the project root
                            </span>
                        </li>
                        <li className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-primary/20 text-primary rounded-full flex items-center justify-center text-xs font-bold">
                                2
                            </span>
                            <span>Add the following variables with your actual values:</span>
                        </li>
                    </ol>

                    <div className="mt-4 bg-black/40 rounded-lg p-4 font-mono text-xs text-white/60 overflow-x-auto">
                        <pre>{getEnvExample()}</pre>
                    </div>
                </div>

                {/* Action Button */}
                <button
                    onClick={() => window.location.reload()}
                    className="w-full bg-primary hover:bg-accent text-white font-semibold py-3 rounded-lg transition-colors"
                >
                    Reload Application
                </button>

                {/* Footer */}
                <p className="text-center text-white/40 text-xs mt-6">
                    Need help? Check the README.md for detailed setup instructions
                </p>
            </div>
        </div>
    );
};
