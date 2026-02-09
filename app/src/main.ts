import { app, BrowserWindow, ipcMain, shell } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import https from "node:https";
import crypto from "node:crypto";

type AppConfig = {
  webuiPort: number;
  ollamaPort: number;
  fileApiPort: number;
  webuiAdminEmail: string;
  webuiAdminPassword: string;
  fileApiKey: string;
  allowedFolders: string[];
};

let mainWindow: BrowserWindow | null = null;

const APP_DIR = "LocalLLMWorkbench";
const DEFAULT_DENYLIST = ".ssh,.gnupg,AppData,.git,node_modules,.env,id_rsa,id_ed25519";

function getAppDataDir() {
  return path.join(app.getPath("appData"), APP_DIR);
}

function getConfigPath() {
  return path.join(getAppDataDir(), "config.json");
}

function findRepoRoot() {
  const candidates = [
    path.resolve(__dirname, "..", ".."),
    path.resolve(process.cwd()),
    process.resourcesPath ? path.resolve(process.resourcesPath, "..") : "",
    process.resourcesPath ? path.resolve(process.resourcesPath) : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const compose = path.join(candidate, "stack", "docker-compose.yml");
    if (fs.existsSync(compose)) return candidate;
  }

  return path.resolve(__dirname, "..", "..");
}

function loadDefaultConfig(): AppConfig {
  const templatePath = path.resolve(__dirname, "..", "scripts", "config-template.json");
  if (fs.existsSync(templatePath)) {
    return JSON.parse(fs.readFileSync(templatePath, "utf8"));
  }
  return {
    webuiPort: 3000,
    ollamaPort: 11434,
    fileApiPort: 8001,
    webuiAdminEmail: "admin@example.com",
    webuiAdminPassword: "ChangeMe123!",
    fileApiKey: "replace-me",
    allowedFolders: ["C:/Users/Public/Documents"],
  };
}

function ensureConfig(): AppConfig {
  const dir = getAppDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const cfgPath = getConfigPath();
  if (!fs.existsSync(cfgPath)) {
    const def = loadDefaultConfig();
    fs.writeFileSync(cfgPath, JSON.stringify(def, null, 2));
    return def;
  }
  return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
}

function writeEnvFile(config: AppConfig) {
  const envPath = path.join(getAppDataDir(), ".env");
  const roots = config.allowedFolders.join(";");
  const rootsHost = config.allowedFolders[0] ?? "C:/Users";
  const body = [
    `WEBUI_HOST_PORT=${config.webuiPort}`,
    `OLLAMA_HOST_PORT=${config.ollamaPort}`,
    `FILE_API_HOST_PORT=${config.fileApiPort}`,
    `WEBUI_ADMIN_EMAIL=${config.webuiAdminEmail}`,
    `WEBUI_ADMIN_PASSWORD=${config.webuiAdminPassword}`,
    `FILE_API_KEY=${config.fileApiKey}`,
    `FILE_API_ROOTS=${roots}`,
    `FILE_API_ROOTS_HOST=${rootsHost}`,
    `FILE_API_DENYLIST=${DEFAULT_DENYLIST}`,
  ].join(os.EOL);
  fs.writeFileSync(envPath, body + os.EOL);
  return envPath;
}

function runCommand(cmd: string, args: string[], cwd?: string): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, shell: false });
    let output = "";
    p.stdout.on("data", (d) => {
      const line = d.toString();
      output += line;
      mainWindow?.webContents.send("setup:log", line.trimEnd());
    });
    p.stderr.on("data", (d) => {
      const line = d.toString();
      output += line;
      mainWindow?.webContents.send("setup:log", line.trimEnd());
    });
    p.on("close", (code) => resolve({ exitCode: code ?? 1, output }));
    p.on("error", (e) => resolve({ exitCode: 1, output: String(e) }));
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function registerIpc() {
  ipcMain.handle("config:get", () => ensureConfig());

  ipcMain.handle("config:set", (_event, cfg: AppConfig) => {
    fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2));
    return { ok: true };
  });

  ipcMain.handle("repo:root", () => findRepoRoot());

  ipcMain.handle("webui:url", () => {
    const cfg = ensureConfig();
    return `http://127.0.0.1:${cfg.webuiPort}`;
  });

  ipcMain.handle("open:external", (_event, url: string) => shell.openExternal(url));

  ipcMain.handle("stack:start", async () => {
    const cfg = ensureConfig();
    const envFile = writeEnvFile(cfg);
    const repoRoot = findRepoRoot();
    const composeFile = path.join(repoRoot, "stack", "docker-compose.yml");
    return runCommand("docker", ["compose", "--env-file", envFile, "-f", composeFile, "up", "-d", "--build"], repoRoot);
  });

  ipcMain.handle("stack:stop", async () => {
    const cfg = ensureConfig();
    const envFile = writeEnvFile(cfg);
    const repoRoot = findRepoRoot();
    const composeFile = path.join(repoRoot, "stack", "docker-compose.yml");
    return runCommand("docker", ["compose", "--env-file", envFile, "-f", composeFile, "down"], repoRoot);
  });

  ipcMain.handle("stack:logs", async (_event, service: string) => {
    const cfg = ensureConfig();
    const envFile = writeEnvFile(cfg);
    const repoRoot = findRepoRoot();
    const composeFile = path.join(repoRoot, "stack", "docker-compose.yml");
    const out = await runCommand("docker", ["compose", "--env-file", envFile, "-f", composeFile, "logs", "--tail", "200", service || "openwebui"], repoRoot);
    return out.output;
  });

  ipcMain.handle("setup:getLogPath", () => path.join(getAppDataDir(), "installer-logs", "install.log"));

  ipcMain.handle("setup:checkDocker", async () => {
    const installed = await runCommand("docker", ["--version"]);
    const running = await runCommand("docker", ["info"]);
    return { installed: installed.exitCode === 0, running: running.exitCode === 0 };
  });

  ipcMain.handle("setup:openDockerDownload", () => shell.openExternal("https://www.docker.com/products/docker-desktop/"));

  ipcMain.handle("setup:downloadVcRedist", async () => {
    const url = "https://aka.ms/vs/17/release/vc_redist.x64.exe";
    const outPath = path.join(os.tmpdir(), "vc_redist.x64.exe");
    await new Promise<void>((resolve, reject) => {
      https.get(url, (res) => {
        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`Failed download (${res.statusCode})`));
          return;
        }
        const total = Number(res.headers["content-length"] || 0);
        const hash = crypto.createHash("sha256");
        let received = 0;
        const ws = fs.createWriteStream(outPath);
        res.on("data", (chunk) => {
          received += chunk.length;
          hash.update(chunk);
          mainWindow?.webContents.send("setup:progress", { id: "vc_redist", received, total: total || undefined });
        });
        res.pipe(ws);
        ws.on("finish", () => {
          ws.close();
          const sha256 = hash.digest("hex");
          fs.writeFileSync(`${outPath}.sha256`, sha256);
          resolve();
        });
        ws.on("error", reject);
      }).on("error", reject);
    });
    const sha256 = fs.readFileSync(`${outPath}.sha256`, "utf8");
    return { outPath, sha256 };
  });

  ipcMain.handle("setup:runVcRedist", async (_event, exePath: string) => runCommand(exePath, ["/install", "/passive", "/norestart"]));

  ipcMain.handle("setup:dockerComposePull", async (_event, repoRoot: string) => {
    const cfg = ensureConfig();
    const envFile = writeEnvFile(cfg);
    const root = repoRoot && fs.existsSync(path.join(repoRoot, "stack", "docker-compose.yml")) ? repoRoot : findRepoRoot();
    const composeFile = path.join(root, "stack", "docker-compose.yml");
    return runCommand("docker", ["compose", "--env-file", envFile, "-f", composeFile, "pull"], root);
  });

  ipcMain.handle("setup:dockerComposeUp", async (_event, repoRoot: string) => {
    const cfg = ensureConfig();
    const envFile = writeEnvFile(cfg);
    const root = repoRoot && fs.existsSync(path.join(repoRoot, "stack", "docker-compose.yml")) ? repoRoot : findRepoRoot();
    const composeFile = path.join(root, "stack", "docker-compose.yml");
    return runCommand("docker", ["compose", "--env-file", envFile, "-f", composeFile, "up", "-d", "--build"], root);
  });

  ipcMain.handle("setup:dockerPs", async () => runCommand("docker", ["ps", "--format", "table {{.Names}}\t{{.Image}}\t{{.Status}}"]));
}

app.whenReady().then(() => {
  ensureConfig();
  registerIpc();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
