# Local LLM Workbench

Local LLM Workbench is a Windows 10/11 desktop experience for running **Open WebUI + Ollama + a secure Filesystem OpenAPI tool** with one installer.

> Compatibility note: this product works with Ollama and Open WebUI, but is not affiliated with either project.

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

## Build from Source
### Prerequisites
- Node.js 20+
- Docker Desktop
- Python 3.11+ (for file-api local testing)
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

### Installer build
```powershell
./installer/build-installer.ps1
```

Final release artifact:
- `dist/LocalLLMWorkbench-Setup.exe`

## Minimal Test Checklist
- [ ] Install with fresh Windows user.
- [ ] Start Menu shortcut opens app.
- [ ] Dashboard can start/stop stack.
- [ ] Open WebUI loads in embedded tab.
- [ ] Admin login works; signup disabled.
- [ ] Filesystem tool appears automatically in Open WebUI tools.
- [ ] `/list` and `/search` respect allowlist and denylist.
