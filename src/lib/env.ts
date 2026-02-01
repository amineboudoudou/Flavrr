/**
 * Environment validation and startup health checks
 * This ensures the app fails fast with clear error messages instead of infinite loading
 */

interface EnvConfig {
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
    VITE_EDGE_FUNCTION_URL?: string;
}

interface ValidationResult {
    isValid: boolean;
    missingVars: string[];
    invalidVars: { name: string; reason: string }[];
}

const REQUIRED_ENV_VARS = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
] as const;

const ENV_VAR_EXAMPLES = {
    VITE_SUPABASE_URL: 'https://your-project.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    VITE_EDGE_FUNCTION_URL: 'https://your-project.supabase.co/functions/v1',
};

/**
 * Validates all required environment variables
 */
export function validateEnv(): ValidationResult {
    const missingVars: string[] = [];
    const invalidVars: { name: string; reason: string }[] = [];

    for (const varName of REQUIRED_ENV_VARS) {
        const value = import.meta.env[varName];

        if (!value) {
            missingVars.push(varName);
            continue;
        }

        // Validate format
        if (varName === 'VITE_SUPABASE_URL') {
            try {
                const url = new URL(value);
                if (!url.hostname.includes('supabase')) {
                    invalidVars.push({
                        name: varName,
                        reason: 'URL must be a Supabase project URL',
                    });
                }
            } catch {
                invalidVars.push({
                    name: varName,
                    reason: 'Invalid URL format',
                });
            }
        }

        if (varName === 'VITE_SUPABASE_ANON_KEY') {
            if (!value.startsWith('eyJ')) {
                invalidVars.push({
                    name: varName,
                    reason: 'Invalid JWT format (should start with "eyJ")',
                });
            }
        }
    }

    return {
        isValid: missingVars.length === 0 && invalidVars.length === 0,
        missingVars,
        invalidVars,
    };
}

/**
 * Gets the validated environment configuration
 * Throws if validation fails
 */
export function getEnv(): EnvConfig {
    const validation = validateEnv();

    if (!validation.isValid) {
        const errors: string[] = [];

        if (validation.missingVars.length > 0) {
            errors.push(`Missing: ${validation.missingVars.join(', ')}`);
        }

        if (validation.invalidVars.length > 0) {
            validation.invalidVars.forEach(({ name, reason }) => {
                errors.push(`${name}: ${reason}`);
            });
        }

        throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
    }

    return {
        VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
        VITE_EDGE_FUNCTION_URL: import.meta.env.VITE_EDGE_FUNCTION_URL,
    };
}

/**
 * Performs startup health checks with timeout
 */
export async function performStartupChecks(): Promise<{
    success: boolean;
    error?: string;
}> {
    console.log('🔍 Running startup health checks...');

    // 1. Validate environment
    const validation = validateEnv();
    if (!validation.isValid) {
        return {
            success: false,
            error: `Environment validation failed: ${validation.missingVars.join(', ')}`,
        };
    }

    // 2. Test Supabase connectivity with timeout
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
            signal: controller.signal,
            headers: {
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
        });

        clearTimeout(timeoutId);

        // The /rest/v1 endpoint often returns 401 unless both apikey and authorization headers are set.
        // For a lightweight health check we only need to verify the project is reachable, so treat 401
        // and 404 as acceptable responses.
        if (!response.ok && response.status !== 404 && response.status !== 401) {
            return {
                success: false,
                error: `Supabase API returned ${response.status}. Check your credentials.`,
            };
        }

        console.log('✅ Startup checks passed');
        return { success: true };
    } catch (error: any) {
        if (error.name === 'AbortError') {
            return {
                success: false,
                error: 'Supabase connection timeout. Check your network or VITE_SUPABASE_URL.',
            };
        }

        return {
            success: false,
            error: `Supabase connection failed: ${error.message}`,
        };
    }
}

/**
 * Returns example .env.local content for setup instructions
 */
export function getEnvExample(): string {
    return Object.entries(ENV_VAR_EXAMPLES)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
}
