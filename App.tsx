import React, { useEffect, useState } from 'react';
import AppRoutes from './AppRoutes';
import { SetupRequiredScreen } from './components/SetupRequiredScreen';
import { validateEnv, performStartupChecks } from './lib/env';

type AppState = 'loading' | 'ready' | 'error';

export const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initializeApp() {
      console.log('🚀 Initializing application...');

      // Step 1: Validate environment
      const validation = validateEnv();
      if (!validation.isValid) {
        if (isMounted) {
          setError('Environment validation failed');
          setAppState('error');
        }
        return;
      }

      // Step 2: Perform startup health checks with timeout
      try {
        const healthCheck = await performStartupChecks();

        if (!healthCheck.success) {
          if (isMounted) {
            setError(healthCheck.error || 'Startup checks failed');
            setAppState('error');
          }
          return;
        }

        // All checks passed
        if (isMounted) {
          console.log('✅ Application initialized successfully');
          setAppState('ready');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Unexpected initialization error');
          setAppState('error');
        }
      }
    }

    initializeApp();

    return () => {
      isMounted = false;
    };
  }, []);

  // Loading state
  if (appState === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/60 text-sm">Initializing application...</p>
          <p className="text-white/40 text-xs mt-2">This should only take a few seconds</p>
        </div>
      </div>
    );
  }

  // Error state
  if (appState === 'error') {
    return <SetupRequiredScreen error={error || undefined} />;
  }

  // Ready state
  return <AppRoutes />;
};
