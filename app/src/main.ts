import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import axios from 'axios';
import log from 'electron-log';
import os from "os";
import https from "https";
import crypto from "crypto";



const appData = path.join(app.getPath('appData'), 'LocalLLMWorkbench');
const configPath = path.join(appData, 'config.json');
const envPath = path.join(appData, '.env');
const logsDir = path.join(appData, 'logs');

const defaultConfig = {
  webuiPort: 3000,
  ollamaPort: 11434,
  fileApiPort: 8001,
  webuiAdminEmail: 'admin@example.com',
  webuiAdminPassword: 'ChangeMe123!',
  fileApiKey: 'replace-me',
  allowedFolders: ['C:/Users/Public/Documents']
};

function ensurePaths() {
  fs.mkdirSync(logsDir, { recursive: true });
  if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
}

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
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
    `FILE_API_ROOTS=${cfg.allowedFolders.map((_: string, i: number) => `/mounted/path${i + 1}`).join(',')}`,
    `FILE_API_ROOTS_HOST=${cfg.allowedFolders[0] || 'C:/Users/Public'}`,
    `FILE_API_DENYLIST=.ssh,.gnupg,AppData,.git,node_modules,.env,id_rsa,id_ed25519,*.pem,*.key`
  ].join('\n');
  fs.writeFileSync(envPath, env);
}

function runCompose(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const composeFile = path.resolve(__dirname, '../../stack/docker-compose.yml');
    const proc = spawn('docker', ['compose', '--env-file', envPath, '-f', composeFile, ...args]);
    let out = '';
    proc.stdout.on('data', d => (out += d.toString()));
    proc.stderr.on('data', d => (out += d.toString()));
    proc.on('close', code => (code === 0 ? resolve(out) : reject(new Error(out))));
  });
}

async function waitForWebUI(port: number) {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await axios.get(`http://127.0.0.1:${port}/health`, { timeout: 2000 });
      if (res.status === 200) return;
    } catch {}
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Open WebUI health check timed out');
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
    if (!token) throw new Error('Missing admin token from Open WebUI signin');

    await axios.post(`${base}/api/v1/tools/openapi`, {
      name: 'Local Filesystem',
      description: 'Read-only files in allowlisted folders',
      openapi_url: 'http://fileapi:8001/openapi.json',
      auth: { type: 'bearer', token: cfg.fileApiKey }
    }, { headers: { Authorization: `Bearer ${token}` } });
    log.info('Filesystem tool registration complete');
  } catch (err) {
    log.error('Tool registration failed', err);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile(path.join(__dirname, 'renderer/index.html'));
}

ipcMain.handle('config:get', () => readConfig());
ipcMain.handle('config:set', (_e, next) => {
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2));
  writeEnv();
  return next;
});
ipcMain.handle('stack:start', async () => {
  writeEnv();
  const output = await runCompose(['up', '-d', '--build']);
  const cfg = readConfig();
  await waitForWebUI(cfg.webuiPort);
  await registerFilesystemTool();
  return output;
});
ipcMain.handle('stack:stop', () => runCompose(['down']));
ipcMain.handle('stack:logs', (_e, service) => runCompose(['logs', '--tail', '100', service]));
ipcMain.handle('webui:url', () => `http://127.0.0.1:${readConfig().webuiPort}`);
ipcMain.handle('open:external', (_e, url) => shell.openExternal(url));

app.whenReady().then(() => {
  ensurePaths();
  writeEnv();
  createWindow();
});
