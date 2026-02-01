import fs from 'node:fs';
import path from 'path';
import os from 'node:os';
import { exec, type ExecException } from 'node:child_process';

import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

const PROJECT_ROOT = fs.realpathSync(path.resolve(__dirname));
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');
const SRC_ROOT_POSIX = SRC_ROOT.split(path.sep).join('/');

const WATCH_IGNORE_SEGMENTS = [
  '.git',
  'node_modules',
  'ios',
  'android',
  'build',
  'dist',
  '.expo',
  '.vercel',
];

const CPU_CHECK_INTERVAL = Number(process.env.DEV_MONITOR_INTERVAL ?? 15000);
const LOAD_WARN_THRESHOLD = Number(process.env.DEV_LOAD_WARN ?? 4);
const CPU_WARN_THRESHOLD = Number(process.env.DEV_CPU_WARN ?? 70);
const FORCE_POLLING = process.env.DEV_FORCE_POLLING === '1';
const POLLING_INTERVAL = Number(process.env.DEV_POLL_INTERVAL ?? 1200);

const chokidarWatchConfig = {
  ignored: (watchedPath: string) => {
    const normalizedPath = watchedPath.split(path.sep).join('/');
    if (!normalizedPath.startsWith(SRC_ROOT_POSIX)) {
      return true;
    }

    return WATCH_IGNORE_SEGMENTS.some((segment) =>
      normalizedPath.includes(`/${segment}/`),
    );
  },
  awaitWriteFinish: {
    stabilityThreshold: 200,
    pollInterval: 100,
  },
  ...(FORCE_POLLING
    ? {
        usePolling: true,
        interval: POLLING_INTERVAL,
      }
    : {}),
};

const stripReactDevArtifactsPlugin = (): PluginOption => ({
  name: 'strip-react-dev-artifacts',
  apply: 'serve',
  enforce: 'post',
  transform(code, id) {
    if (!/\.[tj]sx$/.test(id)) {
      return null;
    }

    const cleaned = code
      .replace(/__source:\s*\{[^}]+\},?\s*/g, '')
      .replace(/__self:\s*this,?\s*/g, '');

    if (cleaned === code) {
      return null;
    }

    return {
      code: cleaned,
      map: null,
    };
  },
});

const performanceGuardPlugin = (): PluginOption => ({
  name: 'dev-performance-guard',
  apply: 'serve',
  configureServer(server) {
    if (process.platform !== 'darwin') {
      return;
    }

    const warn = (message: string) => {
      console.warn(`⚠️  [dev-performance] ${message}`);
    };

    const monitor = () => {
      const [oneMinuteLoad] = os.loadavg();
      if (oneMinuteLoad > LOAD_WARN_THRESHOLD) {
        warn(
          `High system load detected (${oneMinuteLoad.toFixed(
            2,
          )}). Simulator/Xcode indexing can slow hot reloads.`,
        );
      }

      exec(
        "ps -axo pid,pcpu,comm | grep -E 'Simulator|Xcode' | grep -v grep",
        (error: ExecException | null, stdout) => {
          if (error) {
            const exitCode =
              typeof error.code === 'number'
                ? error.code
                : Number(error.code ?? NaN);

            if (Number.isFinite(exitCode) && exitCode === 1) {
              return; // ps found no matching processes, safe to ignore
            }

            warn(`Unable to inspect Simulator/Xcode processes: ${error.message}`);
            return;
          }

          if (!stdout.trim()) {
            return;
          }

          const offenders = stdout
            .trim()
            .split('\n')
            .map((line) => line.trim().split(/\s+/))
            .map((parts) => ({
              cpu: Number.parseFloat(parts[1] ?? '0'),
              command: parts.slice(2).join(' '),
            }))
            .filter(({ cpu }) => cpu >= CPU_WARN_THRESHOLD);

          if (offenders.length > 0) {
            warn(
              `Xcode/Simulator processes are consuming CPU (${offenders
                .map(({ cpu, command }) => `${command} → ${cpu.toFixed(1)}%`)
                .join(', ')}). Close them or pause indexing for a smoother web dev loop.`,
            );
          }
        },
      );
    };

    const interval = setInterval(monitor, CPU_CHECK_INTERVAL);
    server.httpServer?.once('close', () => clearInterval(interval));
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      hmr: {
        host: '127.0.0.1',
        port: 5173,
        protocol: 'ws',
      },
      fs: {
        strict: true,
        allow: [PROJECT_ROOT],
      },
      watch: chokidarWatchConfig,
    },
    plugins: [react(), stripReactDevArtifactsPlugin(), performanceGuardPlugin()],
    css: {
      devSourcemap: false,
    },
    esbuild: {
      sourcemap: false,
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': SRC_ROOT,
      },
    },
  };
});
