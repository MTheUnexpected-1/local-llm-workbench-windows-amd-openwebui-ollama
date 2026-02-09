# Local LLM Workbench

Local LLM Workbench is a Windows 10/11 desktop experience for running **Open WebUI + Ollama + a secure Filesystem OpenAPI tool** with one installer.

> Compatibility note: this product works with Ollama and Open WebUI, but is not affiliated with either project.

## Transparent Installer Behavior (Important)
`LocalLLMWorkbench-Setup.exe` is a WiX Burn bootstrapper and is the **real distribution artifact**.

What it does visibly:
- Runs a **Docker Desktop preflight** step and prompts if Docker is missing or not running.
- Installs the **Local LLM Workbench MSI**.
- Runs a **Test Stack** step and explicitly pulls required images:
  - `ollama/ollama:latest`
  - `ghcr.io/open-webui/open-webui:main`
  - compose pull/build for `fileapi`
- Shows package-by-package progress in the Burn UI.
- Writes verbose logs with timestamps and executed command lines to:
  - `%APPDATA%\LocalLLMWorkbench\installer-logs\install.log`

What it does **not** do:
- It does **not** silently install Docker Desktop.
- It does **not** clone/pull Git repositories during install.
- It does **not** claim that metadata replaces code signing for SmartScreen/UAC trust.

## Quickstart
1. Download `LocalLLMWorkbench-Setup.exe` from Releases.
2. Run installer as Administrator.
3. If prompted, install/start Docker Desktop using the official link shown by setup.
4. Let setup finish MSI install + Test Stack.
5. Launch **Local LLM Workbench** from Start Menu.
=======
## Quickstart
1. Download `LocalLLMWorkbench-Setup.exe` from Releases.
2. Run installer as Administrator.
3. Enter admin email/password during setup.
4. Launch **Local LLM Workbench** from Start Menu.
5. Click **Start Stack** and wait for green status.

6. Open **Open WebUI** tab inside the desktop app.

## Features
- Single downloadable Windows bootstrapper (WiX Burn).
- Electron app with embedded Open WebUI.
- Dockerized stack: `ollama`, `openwebui`, `fileapi`.
- First-run auto-registration of OpenAPI Filesystem tool in Open WebUI.
- Admin-only Open WebUI signup (`ENABLE_SIGNUP=False`).
- Config + logs in `%APPDATA%\LocalLLMWorkbench`.

## Filesystem Tool Security
- Requires bearer token (`FILE_API_KEY`).
- Read-only endpoints: `/health`, `/roots`, `/list`, `/search`.
- Allowlist-only roots.
- Denylist includes `.ssh`, `.gnupg`, `AppData`, `.git`, `node_modules`, `.env`, and key files.

## Pulling Models
- Use Open WebUI model controls, or run:
  - `docker exec llwb-ollama ollama pull llama3.1`
  - `docker exec llwb-ollama ollama list`

## Troubleshooting
- **Docker not running**

  - Error: `Docker Desktop is not running. Start Docker Desktop and rerun setup.`
  - Fix: Start Docker Desktop and re-run installer.
=======
  - Error: `error during connect: this error may indicate that the docker daemon is not running`
  - Fix: Start Docker Desktop and retry.


- **Port already in use**
  - Error: `Bind for 0.0.0.0:3000 failed: port is already allocated`
  - Fix: change host ports in `%APPDATA%\LocalLLMWorkbench\config.json`, save, restart stack.

- **Open WebUI can’t reach Ollama**
  - Error in logs: `Connection refused to http://ollama:11434`
  - Fix: verify `llwb-ollama` is healthy and running.

- **Tool registration failed**
  - Error: `Tool registration failed`
  - Check logs in `%APPDATA%\LocalLLMWorkbench\logs` and retry stack start.

- **Installer step failed**
  - Check `%APPDATA%\LocalLLMWorkbench\installer-logs\install.log`.

=======

## Build from Source
### Prerequisites
- Node.js 20+
- Docker Desktop
- Python 3.11+ (for file-api local testing)

- WiX Toolset v4 (`wix.exe` on PATH)

### Build app MSI
=======
- WiX Toolset v4

### Development run
```powershell
./dev.ps1
```

### Production app build

```powershell
cd app
npm install
npm run package
```


### Build Burn bootstrapper EXE
=======
### Installer build

```powershell
./installer/build-installer.ps1
```

Final release artifact:
- `dist/LocalLLMWorkbench-Setup.exe`

## Minimal Test Checklist

- [ ] Installer shows Docker preflight step.
- [ ] Missing Docker path opens official Docker Desktop URL on consent.
- [ ] Installer shows MSI install step.
- [ ] Installer runs Test Stack step and logs image pulls.
- [ ] `%APPDATA%\LocalLLMWorkbench\installer-logs\install.log` is created with timestamps.
- [ ] Start Menu shortcut opens app.
- [ ] Open WebUI loads in embedded tab.
- [ ] Filesystem tool appears automatically in Open WebUI tools.
=======
- [ ] Install with fresh Windows user.
- [ ] Start Menu shortcut opens app.
- [ ] Dashboard can start/stop stack.
- [ ] Open WebUI loads in embedded tab.
- [ ] Admin login works; signup disabled.
- [ ] Filesystem tool appears automatically in Open WebUI tools.
- [ ] `/list` and `/search` respect allowlist and denylist.

