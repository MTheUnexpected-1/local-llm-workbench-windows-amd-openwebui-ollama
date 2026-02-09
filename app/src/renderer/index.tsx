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
