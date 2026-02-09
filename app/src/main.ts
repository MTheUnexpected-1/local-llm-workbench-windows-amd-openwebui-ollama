import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import https from "https";
import crypto from "crypto";
import { spawn } from "child_process";
import axios from "axios";
import log from "electron-log";

const configPath = path.join(app.getPath("appData"), "LocalLLMWorkbench", "config.json");
const envPath = path.join(app.getPath("appData"), "LocalLLMWorkbench", ".env");
const logsDir = path.join(app.getPath("appData"), "LocalLLMWorkbench", "logs");

const defaultConfig = {
  webuiPort: 3000,
  ollamaPort: 11434,
  fileApiPort: 8001,
  webuiAdminEmail: "admin@example.com",
  webuiAdminPassword: "ChangeMe123!",
  fileApiKey: "replace-me",
  allowedFolders: ["C:/Users/Public/Documents"]
};

function appDataDir() {
  return path.join(app.getPath("appData"), "LocalLLMWorkbench");
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function logFilePath() {
  const dir = path.join(appDataDir(), "installer-logs");
  ensureDir(dir);
  return path.join(dir, "setup.log");
}

function appendLog(line: string) {
  const fp = logFilePath();
  fs.appendFileSync(fp, line + os.EOL, "utf8");
}

function now() {
  return new Date().toISOString();
}

function runCmd(
  cmd: string,
  args: string[],
  cwd?: string,
  onData?: (chunk: string) => void
): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, shell: false, windowsHide: true });

    p.stdout.on("data", (d) => onData?.(d.toString()));
    p.stderr.on("data", (d) => onData?.(d.toString()));

    p.on("error", reject);
    p.on("close", (code) => resolve(code ?? 0));
  });
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    const s = fs.createReadStream(filePath);
    s.on("data", (d) => h.update(d));
    s.on("error", reject);
    s.on("end", () => resolve(h.digest("hex").toUpperCase()));
  });
}

function downloadFile(
  url: string,
  outPath: string,
  onProgress?: (received: number, total?: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(outPath);
          return resolve(downloadFile(res.headers.location, outPath, onProgress));
        }
        if (res.statusCode !== 200) {
          file.close();
          return reject(new Error(`Download failed: ${res.statusCode}`));
        }
        const total = res.headers["content-length"] ? parseInt(res.headers["content-length"], 10) : undefined;
        let received = 0;
        res.on("data", (chunk) => {
          received += chunk.length;
          onProgress?.(received, total);
        });
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", (err) => {
        try { file.close(); } catch {}
        reject(err);
      });
  });
}

async function detectDockerDesktopInstalled(): Promise<boolean> {
  const candidates = [
    path.join(process.env["ProgramFiles"] ?? "C:\\Program Files", "Docker", "Docker", "Docker Desktop.exe"),
    path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Docker", "Docker", "Docker Desktop.exe")
  ];
  return candidates.some((p) => fs.existsSync(p));
}

async function detectDockerRunning(): Promise<boolean> {
  try {
    const code = await runCmd("docker", ["info"], undefined, undefined);
    return code === 0;
  } catch {
    return false;
  }
}

function ensurePaths() {
  ensureDir(logsDir);
  if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
}

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function writeEnv() {
  const cfg = readConfig();
  const env = [
    `WEBUI_ADMIN_EMAIL=${cfg.webuiAdminEmail}`,
    `WEBUI_ADMIN_PASSWORD=${cfg.webuiAdminPassword}`,
    `WEBUI_HOST_PORT=${cfg.webuiPort}`,
    `OLLAMA_HOST_PORT=${cfg.ollamaPort}`,
    `FILE_API_HOST_PORT=${cfg.fileApiPort}`,
    `FILE_API_KEY=${cfg.fileApiKey}`,
    `FILE_API_ROOTS=${cfg.allowedFolders.map((_: string, i: number) => `/mounted/path${i + 1}`).join(",")}`,
    `FILE_API_ROOTS_HOST=${cfg.allowedFolders[0] || "C:/Users/Public"}`,
    "FILE_API_DENYLIST=.ssh,.gnupg,AppData,.git,node_modules,.env,id_rsa,id_ed25519,*.pem,*.key"
  ].join("\n");
  fs.writeFileSync(envPath, env);
}

function runCompose(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const composeFile = path.resolve(__dirname, "../../stack/docker-compose.yml");
    const proc = spawn("docker", ["compose", "--env-file", envPath, "-f", composeFile, ...args]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (out += d.toString()));
    proc.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(out))));
  });
}

async function waitForWebUI(port: number) {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await axios.get(`http://127.0.0.1:${port}/health`, { timeout: 2000 });
      if (res.status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Open WebUI health check timed out");
}

async function registerFilesystemTool() {
  const cfg = readConfig();
  const base = `http://127.0.0.1:${cfg.webuiPort}`;
  try {
    const signin = await axios.post(`${base}/api/v1/auths/signin`, {
      email: cfg.webuiAdminEmail,
      password: cfg.webuiAdminPassword
    });
    const token = signin.data?.token;
    if (!token) throw new Error("Missing admin token from Open WebUI signin");

    await axios.post(`${base}/api/v1/tools/openapi`, {
      name: "Local Filesystem",
      description: "Read-only files in allowlisted folders",
      openapi_url: "http://fileapi:8001/openapi.json",
      auth: { type: "bearer", token: cfg.fileApiKey }
    }, { headers: { Authorization: `Bearer ${token}` } });
    log.info("Filesystem tool registration complete");
  } catch (err) {
    log.error("Tool registration failed", err);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });
  win.loadFile(path.join(__dirname, "renderer/index.html"));
}

ipcMain.handle("setup:getLogPath", async () => logFilePath());
ipcMain.handle("setup:checkDocker", async () => {
  const installed = await detectDockerDesktopInstalled();
  const running = installed ? await detectDockerRunning() : false;
  return { installed, running };
});
ipcMain.handle("setup:openDockerDownload", async () => {
  const url = "https://www.docker.com/products/docker-desktop/";
  await shell.openExternal(url);
  return true;
});
ipcMain.handle("setup:downloadVcRedist", async (_evt, destDir?: string) => {
  const url = "https://aka.ms/vs/17/release/vc_redist.x64.exe";
  const dir = destDir || path.join(os.tmpdir(), "llwb-downloads");
  ensureDir(dir);
  const outPath = path.join(dir, "vc_redist.x64.exe");

  appendLog(`[${now()}] Download VC++ Redist: ${url}`);
  let lastEmit = 0;

  await downloadFile(url, outPath, (received, total) => {
    const t = Date.now();
    if (t - lastEmit > 250) {
      lastEmit = t;
      _evt.sender.send("setup:progress", { id: "vcredist", received, total });
    }
  });

  const hash = await sha256File(outPath);
  appendLog(`[${now()}] Downloaded VC++ Redist to ${outPath}`);
  appendLog(`[${now()}] SHA256 ${hash}`);

  return { outPath, sha256: hash };
});
ipcMain.handle("setup:runVcRedist", async (_evt, exePath: string) => {
  appendLog(`[${now()}] Run VC++ Redist: ${exePath}`);
  _evt.sender.send("setup:log", `[${now()}] Running VC++ Redist installer...`);

  const code = await runCmd(exePath, ["/install", "/passive", "/norestart"], undefined, (chunk) => {
    _evt.sender.send("setup:log", chunk);
    appendLog(chunk.trimEnd());
  });

  appendLog(`[${now()}] VC++ Redist exit code: ${code}`);
  return { exitCode: code };
});
ipcMain.handle("setup:dockerComposePull", async (_evt, repoRoot: string) => {
  const cwd = path.join(repoRoot, "stack");
  appendLog(`[${now()}] docker compose pull (cwd=${cwd})`);
  _evt.sender.send("setup:log", `[${now()}] Running: docker compose pull (in ${cwd})`);

  const code = await runCmd("docker", ["compose", "pull"], cwd, (chunk) => {
    _evt.sender.send("setup:log", chunk);
    appendLog(chunk.trimEnd());
  });

  appendLog(`[${now()}] docker compose pull exit code: ${code}`);
  return { exitCode: code };
});
ipcMain.handle("setup:dockerComposeUp", async (_evt, repoRoot: string) => {
  const cwd = path.join(repoRoot, "stack");
  appendLog(`[${now()}] docker compose up -d (cwd=${cwd})`);
  _evt.sender.send("setup:log", `[${now()}] Running: docker compose up -d (in ${cwd})`);

  const code = await runCmd("docker", ["compose", "up", "-d"], cwd, (chunk) => {
    _evt.sender.send("setup:log", chunk);
    appendLog(chunk.trimEnd());
  });

  appendLog(`[${now()}] docker compose up exit code: ${code}`);
  return { exitCode: code };
});
ipcMain.handle("setup:dockerPs", async (_evt) => {
  const out: string[] = [];
  const code = await runCmd("docker", ["ps"], undefined, (chunk) => out.push(chunk));
  return { exitCode: code, output: out.join("") };
});

ipcMain.handle("config:get", () => readConfig());
ipcMain.handle("config:set", (_e, next) => {
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2));
  writeEnv();
  return next;
});
ipcMain.handle("stack:start", async () => {
  writeEnv();
  const output = await runCompose(["up", "-d", "--build"]);
  const cfg = readConfig();
  await waitForWebUI(cfg.webuiPort);
  await registerFilesystemTool();
  return output;
});
ipcMain.handle("stack:stop", () => runCompose(["down"]));
ipcMain.handle("stack:logs", (_e, service) => runCompose(["logs", "--tail", "100", service]));
ipcMain.handle("webui:url", () => `http://127.0.0.1:${readConfig().webuiPort}`);
ipcMain.handle("open:external", (_e, url) => shell.openExternal(url));
ipcMain.handle("repo:root", () => path.resolve(__dirname, "../.."));

app.whenReady().then(() => {
  ensurePaths();
  writeEnv();
  createWindow();
});
