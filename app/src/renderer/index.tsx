import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

declare global {
  interface Window { llwb: any }
}

const App = () => {
  const [tab, setTab] = useState('Dashboard');
  const [cfg, setCfg] = useState<any>(null);
  const [logs, setLogs] = useState('');
  const [webuiUrl, setWebuiUrl] = useState('http://127.0.0.1:3000');

  useEffect(() => {
    window.llwb.getConfig().then(setCfg);
    window.llwb.webuiUrl().then(setWebuiUrl);
  }, []);

  useEffect(() => {
    const offLog = window.llwb.setup.onLog((line: string) => setLogs((p: string) => p + line + '\n'));
    const offProg = window.llwb.setup.onProgress((p: { id: string; received: number; total?: number }) => {
      const pct = p.total ? ((p.received / p.total) * 100).toFixed(1) : '';
      setLogs((prev: string) => prev + `[progress:${p.id}] ${p.received}/${p.total ?? '?'} ${pct}%\n`);
    });
    return () => { offLog(); offProg(); };
  }, []);

=======

  if (!cfg) return <div>Loading...</div>;

  const save = async () => {
    await window.llwb.setConfig(cfg);
    alert('Configuration saved.');
  };

  return <div className="layout">
    <aside className="sidebar">
      <h3>Local LLM Workbench</h3>
      <div className="badge">Windows 10/11</div>
      <div className="nav">

        {['Dashboard', 'Setup', 'Models', 'Filesystem Tool', 'Open WebUI'].map(x => <button key={x} onClick={() => setTab(x)}>{x}</button>)}
=======
        {['Dashboard', 'Models', 'Filesystem Tool', 'Open WebUI'].map(x => <button key={x} onClick={() => setTab(x)}>{x}</button>)}

      </div>
    </aside>
    <main className="content">
      {tab === 'Dashboard' && <>
        <h2>Services</h2>
        <button onClick={() => window.llwb.startStack()}>Start Stack</button>
        <button onClick={() => window.llwb.stopStack()}>Stop Stack</button>
        <button onClick={async () => setLogs(await window.llwb.getLogs('openwebui'))}>View Open WebUI Logs</button>
        <pre>{logs}</pre>
      </>}

      {tab === 'Setup' && (
        <>
          <h2>Setup (Transparent)</h2>

          <p>This wizard shows every action, logs everything, and never installs Docker silently.</p>

          <button onClick={async () => {
            const p = await window.llwb.setup.getLogPath();
            setLogs((prev: string) => `Setup log: ${p}\n\n` + prev);
          }}>
            Show Log Path
          </button>

          <hr />

          <button onClick={async () => {
            const s = await window.llwb.setup.checkDocker();
            setLogs((prev: string) => prev + `\n[Docker] installed=${s.installed} running=${s.running}\n`);
          }}>
            Check Docker Desktop
          </button>

          <button onClick={async () => {
            await window.llwb.setup.openDockerDownload();
            setLogs((prev: string) => prev + `\nOpened Docker Desktop download page.\n`);
          }}>
            Open Docker Download Page
          </button>

          <hr />

          <button onClick={async () => {
            setLogs((prev: string) => prev + `\nDownloading VC++ Redist...\n`);
            const res = await window.llwb.setup.downloadVcRedist();
            setLogs((prev: string) => prev + `\nDownloaded: ${res.outPath}\nSHA256: ${res.sha256}\n`);
            const run = confirm('Run VC++ Redist installer now?');
            if (run) {
              const r = await window.llwb.setup.runVcRedist(res.outPath);
              setLogs((prev: string) => prev + `\nVC++ Redist exitCode=${r.exitCode}\n`);
            }
          }}>
            Download VC++ Redist
          </button>

          <hr />

          <button onClick={async () => {
            const repoRoot = await window.llwb.getRepoRoot?.() ?? '';
            setLogs((prev: string) => prev + `\nRunning docker compose pull...\n`);
            const r = await window.llwb.setup.dockerComposePull(repoRoot || 'D:\\User\\Documents\\GitHub\\local-llm-workbench-windows-amd-openwebui-ollama');
            setLogs((prev: string) => prev + `\ndocker compose pull exitCode=${r.exitCode}\n`);
          }}>
            Pull Docker Images
          </button>

          <button onClick={async () => {
            const repoRoot = await window.llwb.getRepoRoot?.() ?? '';
            setLogs((prev: string) => prev + `\nRunning docker compose up -d...\n`);
            const r = await window.llwb.setup.dockerComposeUp(repoRoot || 'D:\\User\\Documents\\GitHub\\local-llm-workbench-windows-amd-openwebui-ollama');
            setLogs((prev: string) => prev + `\ndocker compose up exitCode=${r.exitCode}\n`);
          }}>
            Start Stack (compose up)
          </button>

          <button onClick={async () => {
            const r = await window.llwb.setup.dockerPs();
            setLogs((prev: string) => prev + `\nDocker ps (exitCode=${r.exitCode}):\n${r.output}\n`);
          }}>
            Show docker ps
          </button>

          <hr />

          <h3>Live Output</h3>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{logs}</pre>
        </>
      )}
=======

      {tab === 'Models' && <>
        <h2>Ollama Models</h2>
        <p>Use Open WebUI model picker, or run <code>docker exec llwb-ollama ollama pull mistral</code>.</p>
      </>}
      {tab === 'Filesystem Tool' && <>
        <h2>Filesystem Tool</h2>
        <label>Allowed folders (comma separated)</label>
        <input value={cfg.allowedFolders.join(',')} onChange={e => setCfg({ ...cfg, allowedFolders: e.target.value.split(',').map((v: string) => v.trim()) })} />
        <label>Tool token</label>
        <input value={cfg.fileApiKey} onChange={e => setCfg({ ...cfg, fileApiKey: e.target.value })} />
        <button onClick={save}>Apply Changes</button>
      </>}
      {tab === 'Open WebUI' && <>
        <h2>Open WebUI</h2>
        <button onClick={() => window.llwb.openExternal(`${webuiUrl}/admin`)}>Manage Users</button>
        <webview src={webuiUrl}></webview>
      </>}
    </main>
  </div>;
};

createRoot(document.getElementById('root')!).render(<App />);
