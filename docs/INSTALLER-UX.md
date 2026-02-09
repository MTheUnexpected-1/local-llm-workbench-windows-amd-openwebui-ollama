# Installer UX Modernization (WiX Burn)

## Recommended path
For a premium 2025–2026 installer UX, move from WixStandardBootstrapperApplication to a custom **WPF Managed BA**.

Why:
- Real-time package + action status can be surfaced from Burn events.
- You can build a dark, glassmorphism UI with icons and animated progress.
- You can show a live log panel and grouped file list more cleanly than StdBA.

## Practical phased approach
1. **Now (implemented):** improved StdBA + grouped progress step + explicit package names.
2. **Next:** custom WPF BA for richer event-driven UI.

## Useful Burn events to wire in a custom BA
- DetectBegin / DetectComplete
- PlanBegin / PlanPackageBegin / PlanComplete
- ExecuteBegin / ExecutePackageBegin / ExecuteProgress / ExecutePackageComplete / ExecuteComplete
- CacheAcquireProgress for download bytes

## Suggested status text examples
- Checking prerequisites…
- Installing Microsoft Visual C++ Redistributable…
- Extracting Local LLM Workbench payload…
- Installing Local LLM Workbench MSI…
- Registering shortcuts…
- Starting Docker stack validation…
- Finishing setup…

## Representative file list pattern
If per-file MSI callbacks are unavailable in Burn UI, show grouped representative files:
- Local LLM Workbench.exe
- resources/app.asar
- locales/*.pak
- shortcuts + uninstall registration

These are logged via installer scripts to `%APPDATA%\\LocalLLMWorkbench\\installer-logs\\install.log`.
