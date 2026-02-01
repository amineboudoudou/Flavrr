# Dev Performance & Stability

These guidelines keep the web dev server responsive even when Xcode or the iOS Simulator is installed or running in the background.

## Quick start

```bash
npm install
npm run dev
```

The Vite server now:

- Binds to `127.0.0.1:3000` with `strictPort`, so it never races other tools.
- Limits file watching to app sources (components, pages, lib, contexts, hooks, supabase, public) and ignores `.git`, `node_modules`, `ios`, `android`, `build`, `dist`, `.expo`, `.vercel`.
- Disables dev-time source maps and strips React debugging metadata to keep HMR payloads tiny.
- Warns in the terminal if Xcode, Simulator, or Spotlight indexing consume CPU.

## Working alongside Xcode or Simulator

1. **No dependency on native tooling** – This repo is pure Vite/React; you never need Xcode, Metro, or Expo to run the web app.
2. **Keep iOS Simulator throttled** – Close unused simulators or reduce active devices. Their rendering loops compete for CPU and GPU.
3. **Pause/limit Xcode indexing** – In Xcode Preferences → Locations → Advanced…, switch to *Manual* when not building native targets. Alternatively, run `defaults write com.apple.dt.Xcode IDEIndexerSchedulePolicy -int 0` to keep indexing on-demand.
4. **Use Activity Monitor** – If `Xcode`, `Simulator`, or `CoreSimulatorService` exceed ~70% CPU, stop/pause them. The dev server prints warnings when it detects this threshold.
5. **Disable automatic device discovery** – In Simulator → Preferences → Devices, uncheck “Connect hardware keyboard” and “Show as running device”. This reduces background syncing.

## macOS tuning tips

- **Spotlight**: Exclude your repo (`System Settings → Siri & Spotlight → Spotlight Privacy`). Prevents re-index scans during large file saves.
- **File watching**: The server defaults to native watchers. If you hit FSEvents limits, set `DEV_FORCE_POLLING=1 DEV_POLL_INTERVAL=1500 npm run dev` for low-frequency polling.
- **Thermal throttling**: Keep your Mac plugged in and avoid running Simulator graphics-heavy apps alongside the web preview.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Terminal prints `High system load detected` | Close heavy apps (Simulators, Xcode, video editors) or lower CPU warning thresholds via `DEV_LOAD_WARN`/`DEV_CPU_WARN`. |
| HMR feels slow | Confirm Activity Monitor shows Node/Vite under 150% combined CPU. If not, restart `npm run dev` to reset watchers. |
| “Port in use” error | Another tool is already on 3000. Stop it or run `PORT=3000 npm run dev`. Strict porting prevents silent port hopping. |
| Needing polling in CI | Set `DEV_FORCE_POLLING=1` and optionally `DEV_POLL_INTERVAL` (ms). |

## Environment switches

| Variable | Purpose | Default |
| --- | --- | --- |
| `DEV_FORCE_POLLING` | Force chokidar to use polling watchers. | disabled |
| `DEV_POLL_INTERVAL` | Poll interval when polling is enabled. | `1200` ms |
| `DEV_MONITOR_INTERVAL` | Frequency of CPU/load checks. | `15000` ms |
| `DEV_LOAD_WARN` | 1-minute load average threshold for warnings. | `4` |
| `DEV_CPU_WARN` | Minimum per-process CPU % from Xcode/Simulator that triggers warnings. | `70` |

Document these settings in PRs if you change them so everyone’s loop stays fast.
