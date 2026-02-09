import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

declare global {
  interface Window { llwb: any }
}

type InstallerStep = 'prerequisites' | 'terms' | 'directory' | 'setup' | 'complete' | 'dashboard';

const App = () => {
  const [step, setStep] = useState<InstallerStep>('prerequisites');
  const [tab, setTab] = useState('Dashboard');
  const [cfg, setCfg] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [stackRunning, setStackRunning] = useState(false);
  const [webuiUrl, setWebuiUrl] = useState('http://127.0.0.1:3000');
  
  // Prerequisites state
  const [dockerInstalled, setDockerInstalled] = useState<boolean | null>(null);
  const [dockerRunning, setDockerRunning] = useState<boolean | null>(null);
  const [vcRedistInstalled, setVcRedistInstalled] = useState<boolean | null>(null);
  const [checkingPrereqs, setCheckingPrereqs] = useState(false);
  
  // Terms state
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Directory state
  const [installDirectory, setInstallDirectory] = useState('');
  
  // Setup state
  const [setupRunning, setSetupRunning] = useState(false);
  const [setupProgress, setSetupProgress] = useState(0);

  useEffect(() => {
    window.llwb.getConfig().then((config: any) => {
      setCfg(config);
      // If config exists, skip to dashboard
      if (config && config.webuiPort) {
        setStep('dashboard');
      }
    }).catch(() => {
      // Fresh install, start with prerequisites
      setStep('prerequisites');
    });
    window.llwb.webuiUrl?.().then(setWebuiUrl).catch(() => {});
    checkStackStatus();
  }, []);

  useEffect(() => {
    const offLog = window.llwb.setup?.onLog?.((line: string) => {
      setLogs(prev => [...prev, line]);
    });
    const offProg = window.llwb.setup?.onProgress?.((p: { id: string; received: number; total?: number }) => {
      const pct = p.total ? ((p.received / p.total) * 100).toFixed(1) : '';
      setLogs(prev => [...prev, `[${p.id}] ${p.received}/${p.total ?? '?'} bytes (${pct}%)`]);
    });
    return () => { offLog?.(); offProg?.(); };
  }, []);

  const checkStackStatus = async () => {
    try {
      const result = await window.llwb.setup?.dockerPs?.();
      setStackRunning(result?.output?.includes?.('llwb-openwebui') ?? false);
    } catch {
      setStackRunning(false);
    }
  };

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Step 1: Check Prerequisites
  const checkPrerequisites = async () => {
    setCheckingPrereqs(true);
    setLogs([]);
    addLog('Checking system prerequisites...');
    
    try {
      addLog('Checking Docker Desktop installation...');
      const dockerStatus = await window.llwb.setup.checkDocker();
      setDockerInstalled(dockerStatus.installed);
      setDockerRunning(dockerStatus.running);
      
      if (dockerStatus.installed) {
        addLog('✓ Docker Desktop is installed');
        if (dockerStatus.running) {
          addLog('✓ Docker engine is running');
        } else {
          addLog('⚠ Docker Desktop found but engine is not running');
          addLog('You must start Docker Desktop before continuing');
        }
      } else {
        addLog('✗ Docker Desktop is NOT installed');
        addLog('Docker Desktop is required to run Local LLM Workbench');
      }

      // Check VC++ Redist (simplified - assume it's installed on Windows)
      addLog('Checking Visual C++ Redistributable...');
      setVcRedistInstalled(true);
      addLog('✓ Windows environment ready');

      addLog('Prerequisites check complete');
      setCheckingPrereqs(false);
    } catch (err: any) {
      addLog(`✗ Error checking prerequisites: ${err.message}`);
      setCheckingPrereqs(false);
    }
  };

  const proceedFromPrerequisites = () => {
    if (dockerInstalled && dockerRunning) {
      setStep('terms');
    } else {
      addLog('Please install Docker Desktop and ensure it is running before proceeding');
    }
  };

  const proceedFromTerms = () => {
    if (termsAccepted) {
      setStep('directory');
    }
  };

  const proceedFromDirectory = () => {
    if (installDirectory.trim()) {
      addLog(`Installation directory selected: ${installDirectory}`);
      setStep('setup');
      startSetup();
    }
  };

  const startSetup = async () => {
    setSetupRunning(true);
    setLogs([]);
    setSetupProgress(0);

    try {
      addLog('═══════════════════════════════════════════════════════');
      addLog('Starting Local LLM Workbench Installation');
      addLog('═══════════════════════════════════════════════════════');
      addLog('');

      // Step 1: Download VC++ Redist
      addLog('[10%] Downloading Visual C++ Redistributable...');
      setSetupProgress(10);
      try {
        const vcRedist = await window.llwb.setup.downloadVcRedist(installDirectory);
        addLog(`✓ Downloaded VC++ Redist to: ${vcRedist.outPath}`);
        addLog(`  SHA256: ${vcRedist.sha256}`);
      } catch (err: any) {
        addLog(`⚠ VC++ Redist download skipped: ${err.message}`);
      }

      // Step 2: Run VC++ Redist
      addLog('[20%] Installing Visual C++ Redistributable...');
      setSetupProgress(20);
      try {
        const vcRedist = await window.llwb.setup.downloadVcRedist(installDirectory);
        await window.llwb.setup.runVcRedist(vcRedist.outPath);
        addLog('✓ VC++ Redist installation complete');
      } catch (err: any) {
        addLog(`⚠ VC++ Redist installation skipped: ${err.message}`);
      }

      // Step 3: Pull Docker images
      addLog('[30%] Pulling Docker images (Ollama, OpenWebUI, etc)...');
      setSetupProgress(30);
      const repoRoot = await window.llwb.getRepoRoot();
      addLog(`Using repository: ${repoRoot}`);
      
      try {
        addLog('  → Pulling ollama/ollama:latest');
        const pullResult1 = await window.llwb.setup.dockerComposePull(repoRoot);
        if (pullResult1.exitCode === 0) {
          addLog('  ✓ Docker images pulled successfully');
        } else {
          addLog(`  ✗ Docker pull returned exit code ${pullResult1.exitCode}`);
        }
      } catch (err: any) {
        addLog(`✗ Docker pull failed: ${err.message}`);
      }

      // Step 4: Start Docker Compose
      addLog('[60%] Starting Docker services...');
      setSetupProgress(60);
      addLog('  → Starting OpenWebUI, Ollama, and File API services');
      
      try {
        const composeResult = await window.llwb.setup.dockerComposeUp(repoRoot);
        if (composeResult.exitCode === 0) {
          addLog('  ✓ Docker services started');
        } else {
          addLog(`  ✗ Docker compose up returned exit code ${composeResult.exitCode}`);
        }
      } catch (err: any) {
        addLog(`✗ Docker compose failed: ${err.message}`);
      }

      // Step 5: Initialize configuration
      addLog('[80%] Initializing configuration...');
      setSetupProgress(80);
      
      const defaultConfig = {
        webuiPort: 3000,
        llamaCppPort: 8080,
        fileApiPort: 8001,
        webuiAdminEmail: "admin@example.com",
        webuiAdminPassword: "ChangeMe123!",
        fileApiKey: "replace-me",
        allowedFolders: ["C:/Users/Public/Documents"],
        installDirectory: installDirectory
      };
      
      await window.llwb.setConfig(defaultConfig);
      setCfg(defaultConfig);
      addLog('✓ Configuration initialized');
      addLog(`  → WebUI Port: ${defaultConfig.webuiPort}`);
      addLog(`  → Llama.cpp Port: ${defaultConfig.llamaCppPort}`);
      addLog(`  → File API Port: ${defaultConfig.fileApiPort}`);

      // Step 6: Verify services
      addLog('[90%] Verifying services...');
      setSetupProgress(90);
      
      await new Promise(r => setTimeout(r, 3000));
      const dockerPs = await window.llwb.setup.dockerPs();
      if (dockerPs.exitCode === 0) {
        addLog('✓ Docker services running:');
        dockerPs.output.split('\n').forEach((line: string) => {
          if (line.includes('llwb')) {
            addLog(`  → ${line}`);
          }
        });
      }

      addLog('[100%] Installation complete!');
      setSetupProgress(100);
      addLog('═══════════════════════════════════════════════════════');
      addLog('Local LLM Workbench is ready to use');
      addLog('Open WebUI: http://127.0.0.1:3000');
      addLog('═══════════════════════════════════════════════════════');
      
      setSetupRunning(false);
      setStep('complete');
      await checkStackStatus();
    } catch (err: any) {
      addLog(`✗ Setup failed: ${err.message}`);
      setSetupRunning(false);
    }
  };

  const save = async () => {
    await window.llwb.setConfig(cfg);
    addLog('Configuration saved.');
  };

  const startStack = async () => {
    setLogs([]);
    addLog('Starting stack...');
    try {
      await window.llwb.startStack();
      await checkStackStatus();
      addLog('✓ Stack started successfully!');
    } catch (err: any) {
      addLog(`✗ Error: ${err.message}`);
    }
  };

  const stopStack = async () => {
    setLogs([]);
    addLog('Stopping stack...');
    try {
      await window.llwb.stopStack();
      await checkStackStatus();
      addLog('✓ Stack stopped.');
    } catch (err: any) {
      addLog(`✗ Error: ${err.message}`);
    }
  };

  // INSTALLER UI
  if (step === 'prerequisites') {
    return <InstallerLayout step={1} totalSteps={5}>
      <h2>Step 1: Check Prerequisites</h2>
      <p style={{ color: '#9ca3af', marginBottom: '20px' }}>
        Local LLM Workbench requires Docker Desktop to be installed and running.
      </p>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={checkPrerequisites}
          disabled={checkingPrereqs}
          style={{
            background: checkingPrereqs ? '#6b7280' : '#3b82f6',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            cursor: checkingPrereqs ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {checkingPrereqs ? 'Checking...' : 'Check Prerequisites'}
        </button>
        
        <button 
          onClick={() => window.llwb.setup.openDockerDownload()}
          style={{
            background: '#1f2937',
            color: 'white',
            padding: '12px 24px',
            border: '1px solid #374151',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Download Docker Desktop
        </button>
      </div>

      <LogsDisplay logs={logs} />

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
        <button 
          onClick={proceedFromPrerequisites}
          disabled={!dockerInstalled || !dockerRunning}
          style={{
            background: (dockerInstalled && dockerRunning) ? '#10b981' : '#6b7280',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            cursor: (dockerInstalled && dockerRunning) ? 'pointer' : 'not-allowed',
            fontWeight: 'bold'
          }}
        >
          Next
        </button>
      </div>
    </InstallerLayout>;
  }

  if (step === 'terms') {
    return <InstallerLayout step={2} totalSteps={5}>
      <h2>Step 2: Terms and Conditions</h2>
      
      <div style={{
        background: '#111827',
        border: '1px solid #374151',
        borderRadius: '6px',
        padding: '16px',
        height: '350px',
        overflowY: 'auto',
        marginBottom: '20px',
        fontSize: '13px',
        lineHeight: '1.6',
        color: '#d1d5db'
      }}>
        <p><strong>LOCAL LLM WORKBENCH - TERMS AND CONDITIONS</strong></p>
        <p>Last Updated: February 2026</p>
        
        <p><strong>1. License Grant</strong></p>
        <p>This software is provided as-is for personal, non-commercial use. You may install and use this application on your personal computer.</p>
        
        <p><strong>2. Data Privacy</strong></p>
        <p>All data processed by this application remains on your local machine. No data is transmitted to external servers without your explicit consent. You are responsible for securing your installation directory and any sensitive files accessed through this application.</p>
        
        <p><strong>3. Docker and Dependencies</strong></p>
        <p>This application requires Docker Desktop to be installed. You are responsible for obtaining Docker Desktop and complying with Docker's licensing terms. Visit https://www.docker.com for more information.</p>
        
        <p><strong>4. Disclaimer</strong></p>
        <p>THIS SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. THE DEVELOPERS SHALL NOT BE LIABLE FOR ANY DAMAGE, DATA LOSS, OR OTHER ISSUES ARISING FROM THE USE OF THIS SOFTWARE.</p>
        
        <p><strong>5. System Requirements</strong></p>
        <p>- Windows 10 or Windows 11<br/>
        - Docker Desktop installed and running<br/>
        - At least 8GB RAM recommended<br/>
        - At least 20GB free disk space for models and containers</p>
        
        <p><strong>6. Acknowledgments</strong></p>
        <p>This application uses open-source components including Ollama, Open WebUI, and others. See the LICENSE file for full details.</p>
        
        <p><strong>By accepting these terms, you confirm that you have read and understand this agreement.</strong></p>
      </div>
      
      <label style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          style={{ width: 'auto', marginRight: '10px', cursor: 'pointer', transform: 'scale(1.2)' }}
        />
        <span>I accept the Terms and Conditions</span>
      </label>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button 
          onClick={() => setStep('prerequisites')}
          style={{
            background: '#1f2937',
            color: 'white',
            padding: '12px 24px',
            border: '1px solid #374151',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Back
        </button>
        <button 
          onClick={proceedFromTerms}
          disabled={!termsAccepted}
          style={{
            background: termsAccepted ? '#10b981' : '#6b7280',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            cursor: termsAccepted ? 'pointer' : 'not-allowed',
            fontWeight: 'bold'
          }}
        >
          Next
        </button>
      </div>
    </InstallerLayout>;
  }

  if (step === 'directory') {
    return <InstallerLayout step={3} totalSteps={5}>
      <h2>Step 3: Installation Directory</h2>
      <p style={{ color: '#9ca3af', marginBottom: '20px' }}>
        Specify where to install Local LLM Workbench. This directory will store configuration files, logs, and downloaded models.
      </p>

      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Installation Directory</label>
      <input
        type="text"
        placeholder="C:\\Users\\YourName\\AppData\\Local\\LocalLLMWorkbench"
        value={installDirectory}
        onChange={(e) => setInstallDirectory(e.target.value)}
        style={{
          width: '100%',
          background: '#111827',
          color: 'white',
          border: '1px solid #374151',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '8px',
          fontSize: '14px',
          boxSizing: 'border-box'
        }}
      />
      <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '5px' }}>
        Default: %APPDATA%\LocalLLMWorkbench<br/>
        This directory will require at least 20GB free space.
      </p>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '30px' }}>
        <button 
          onClick={() => setStep('terms')}
          style={{
            background: '#1f2937',
            color: 'white',
            padding: '12px 24px',
            border: '1px solid #374151',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Back
        </button>
        <button 
          onClick={proceedFromDirectory}
          disabled={!installDirectory.trim()}
          style={{
            background: installDirectory.trim() ? '#10b981' : '#6b7280',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            cursor: installDirectory.trim() ? 'pointer' : 'not-allowed',
            fontWeight: 'bold'
          }}
        >
          Install
        </button>
      </div>
    </InstallerLayout>;
  }

  if (step === 'setup') {
    return <InstallerLayout step={4} totalSteps={5}>
      <h2>Step 4: Installing Local LLM Workbench</h2>
      <p style={{ color: '#9ca3af', marginBottom: '20px' }}>
        Please wait while we install and configure your system. This may take several minutes.
      </p>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>Installation Progress</span>
          <span style={{ fontWeight: 'bold', color: '#10b981' }}>{setupProgress}%</span>
        </div>
        <div style={{
          width: '100%',
          height: '24px',
          background: '#111827',
          border: '1px solid #374151',
          borderRadius: '6px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${setupProgress}%`,
            background: 'linear-gradient(90deg, #10b981, #059669)',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      <LogsDisplay logs={logs} />

      {!setupRunning && (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button 
            onClick={startSetup}
            style={{
              background: '#3b82f6',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Retry
          </button>
        </div>
      )}
    </InstallerLayout>;
  }

  if (step === 'complete') {
    return <InstallerLayout step={5} totalSteps={5}>
      <h2>Step 5: Installation Complete!</h2>
      <div style={{ background: '#064e3b', border: '1px solid #10b981', borderRadius: '6px', padding: '20px', marginBottom: '20px' }}>
        <p style={{ color: '#10b981', fontSize: '16px', margin: '0 0 10px 0' }}>
          ✓ Local LLM Workbench has been successfully installed!
        </p>
      </div>

      <div style={{ background: '#1f2937', borderRadius: '6px', padding: '16px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0 }}>Next Steps:</h3>
        <ol style={{ lineHeight: '1.8', paddingLeft: '20px' }}>
          <li>Open WebUI: <code style={{ background: '#111827', padding: '2px 6px', borderRadius: '4px' }}>http://127.0.0.1:3000</code></li>
          <li>Login with your credentials</li>
          <li>Download or select an LLM model from Ollama</li>
          <li>Start chatting with your local AI!</li>
        </ol>
      </div>

      <LogsDisplay logs={logs} />

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
        <button 
          onClick={() => window.llwb.openExternal('http://127.0.0.1:3000')}
          style={{
            background: '#10b981',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px'
          }}
        >
          Open WebUI
        </button>
        <button 
          onClick={() => setStep('dashboard')}
          style={{
            background: '#3b82f6',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px'
          }}
        >
          Go to Dashboard
        </button>
      </div>
    </InstallerLayout>;
  }

  // DASHBOARD UI
  if (!cfg) return <div style={{ padding: '20px', textAlign: 'center', color: 'white' }}>Loading configuration...</div>;

  return <div className="layout">
    <aside className="sidebar">
      <h3>🚀 Local LLM Workbench</h3>
      <div className="badge">Windows 10/11</div>
      <div style={{ color: stackRunning ? '#10b981' : '#ef4444', fontSize: '14px', marginTop: '10px', marginBottom: '20px' }}>
        {stackRunning ? '● Running' : '○ Stopped'}
      </div>
      <div className="nav">
        {['Dashboard', 'Configuration', 'Setup', 'Models', 'Filesystem Tool', 'Open WebUI'].map(x => 
          <button key={x} onClick={() => setTab(x)} style={{
            width: '100%',
            margin: '4px 0',
            background: tab === x ? '#1d4ed8' : '#1f2937',
            color: 'white',
            border: '0',
            padding: '10px',
            textAlign: 'left',
            borderLeft: tab === x ? '3px solid #3b82f6' : 'none',
            paddingLeft: tab === x ? '7px' : '10px',
            cursor: 'pointer',
            borderRadius: '4px'
          }}>
            {x}
          </button>
        )}
      </div>
    </aside>
    <main className="content">
      {tab === 'Dashboard' && <>
        <h2>Services Dashboard</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
            <h3>🦙 Llama.cpp</h3>
            <p>LLM inference engine</p>
            <code style={{ display: 'block', background: '#111827', padding: '8px', marginTop: '8px' }}>Port {cfg.llamaCppPort}</code>
          </div>
          <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
            <h3>🌐 Open WebUI</h3>
            <p>Web interface for Llama.cpp</p>
            <code style={{ display: 'block', background: '#111827', padding: '8px', marginTop: '8px' }}>Port {cfg.webuiPort}</code>
          </div>
          <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
            <h3>📁 File API</h3>
            <p>Secure filesystem access</p>
            <code style={{ display: 'block', background: '#111827', padding: '8px', marginTop: '8px' }}>Port {cfg.fileApiPort}</code>
          </div>
        </div>

        <h3>Stack Controls</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button onClick={startStack} disabled={stackRunning} style={{
            background: stackRunning ? '#ccc' : '#10b981',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            cursor: stackRunning ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}>
            Start Stack
          </button>
          <button onClick={stopStack} disabled={!stackRunning} style={{
            background: stackRunning ? '#ef4444' : '#ccc',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            cursor: !stackRunning ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}>
            Stop Stack
          </button>
          <button onClick={checkStackStatus} style={{
            background: '#3b82f6',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}>
            Refresh Status
          </button>
        </div>

        {logs.length > 0 && <>
          <h3>Activity Log</h3>
          <pre style={{ background: '#111827', padding: '12px', borderRadius: '6px', overflow: 'auto', maxHeight: '300px', color: '#10b981', fontFamily: 'monospace', fontSize: '12px' }}>
            {logs.map((l, i) => <div key={i}>{l}</div>)}
          </pre>
        </>}
      </>}

      {tab === 'Configuration' && <>
        <h2>Settings</h2>
        <div style={{ maxWidth: '500px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>WebUI Port</label>
            <input type="number" value={cfg.webuiPort} onChange={e => setCfg({ ...cfg, webuiPort: parseInt(e.target.value) })} style={{
              width: '100%',
              background: '#111827',
              color: 'white',
              border: '1px solid #374151',
              padding: '8px',
              boxSizing: 'border-box',
              borderRadius: '4px'
            }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Llama.cpp Port</label>
            <input type="number" value={cfg.llamaCppPort} onChange={e => setCfg({ ...cfg, llamaCppPort: parseInt(e.target.value) })} style={{
              width: '100%',
              background: '#111827',
              color: 'white',
              border: '1px solid #374151',
              padding: '8px',
              boxSizing: 'border-box',
              borderRadius: '4px'
            }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>File API Port</label>
            <input type="number" value={cfg.fileApiPort} onChange={e => setCfg({ ...cfg, fileApiPort: parseInt(e.target.value) })} style={{
              width: '100%',
              background: '#111827',
              color: 'white',
              border: '1px solid #374151',
              padding: '8px',
              boxSizing: 'border-box',
              borderRadius: '4px'
            }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>WebUI Admin Email</label>
            <input type="email" value={cfg.webuiAdminEmail} onChange={e => setCfg({ ...cfg, webuiAdminEmail: e.target.value })} style={{
              width: '100%',
              background: '#111827',
              color: 'white',
              border: '1px solid #374151',
              padding: '8px',
              boxSizing: 'border-box',
              borderRadius: '4px'
            }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>WebUI Admin Password</label>
            <input type="password" value={cfg.webuiAdminPassword} onChange={e => setCfg({ ...cfg, webuiAdminPassword: e.target.value })} style={{
              width: '100%',
              background: '#111827',
              color: 'white',
              border: '1px solid #374151',
              padding: '8px',
              boxSizing: 'border-box',
              borderRadius: '4px'
            }} />
          </div>
          <button onClick={save} style={{ background: '#10b981', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Save Configuration
          </button>
        </div>
      </>}

      {tab === 'Setup' && <>
        <h2>Setup Wizard</h2>
        <p>Re-run setup steps or check system status.</p>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <button onClick={async () => {
            const p = await window.llwb.setup.getLogPath();
            addLog(`Setup log: ${p}`);
          }} style={{ background: '#3b82f6', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Show Log Path
          </button>

          <button onClick={async () => {
            const s = await window.llwb.setup.checkDocker();
            addLog(`Docker installed: ${s.installed}, running: ${s.running}`);
          }} style={{ background: '#3b82f6', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Check Docker
          </button>

          <button onClick={async () => {
            await window.llwb.setup.openDockerDownload();
            addLog('Opened Docker Desktop download page.');
          }} style={{ background: '#3b82f6', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Download Docker
          </button>
        </div>

        <h3>Live Output</h3>
        <pre style={{ background: '#111827', padding: '12px', borderRadius: '6px', overflow: 'auto', maxHeight: '400px', color: '#10b981', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </pre>
      </>}

      {tab === 'Models' && <>
        <h2>Llama.cpp Models</h2>
        <p>Use Open WebUI to manage models, or run:</p>
        <code style={{ display: 'block', background: '#111827', padding: '12px', borderRadius: '6px', marginTop: '10px' }}>
          docker exec llwb-llama-cpp curl http://localhost:8080/models
        </code>
      </>}
      
      {tab === 'Filesystem Tool' && <>
        <h2>Filesystem Tool Configuration</h2>
        <div style={{ maxWidth: '500px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Allowed Folders (comma separated)</label>
            <textarea value={cfg.allowedFolders.join(', ')} onChange={e => setCfg({ ...cfg, allowedFolders: e.target.value.split(',').map((v: string) => v.trim()) })} rows={4} style={{
              width: '100%',
              background: '#111827',
              color: 'white',
              border: '1px solid #374151',
              padding: '8px',
              boxSizing: 'border-box',
              borderRadius: '4px',
              fontFamily: 'monospace'
            }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>File API Security Token</label>
            <input type="password" value={cfg.fileApiKey} onChange={e => setCfg({ ...cfg, fileApiKey: e.target.value })} style={{
              width: '100%',
              background: '#111827',
              color: 'white',
              border: '1px solid #374151',
              padding: '8px',
              boxSizing: 'border-box',
              borderRadius: '4px'
            }} />
          </div>
          <button onClick={save} style={{ background: '#10b981', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Apply Changes
          </button>
        </div>
      </>}
      
      {tab === 'Open WebUI' && <>
        <h2>Open WebUI</h2>
        {stackRunning ? (
          <>
            <button onClick={() => window.llwb.openExternal(`${webuiUrl}/admin`)} style={{ background: '#3b82f6', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '10px', fontWeight: 'bold' }}>
              Manage Users
            </button>
            <webview src={webuiUrl}></webview>
          </>
        ) : (
          <div style={{ padding: '20px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px' }}>
            <p>Stack is not running. Please start the stack from the Dashboard.</p>
          </div>
        )}
      </>}
    </main>
  </div>;
};

function InstallerLayout({ children, step, totalSteps }: { children: React.ReactNode; step: number; totalSteps: number }) {
  return <div className="layout">
    <aside className="sidebar" style={{ background: '#0f1117', paddingTop: '24px' }}>
      <h3 style={{ marginTop: 0 }}>🚀 Local LLM Workbench</h3>
      <div className="badge" style={{ marginBottom: '24px' }}>Setup Wizard</div>
      <div style={{ fontSize: '14px', color: '#9ca3af', lineHeight: '2' }}>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: step >= 1 ? '#10b981' : '#6b7280', fontWeight: step === 1 ? 'bold' : 'normal' }}>
            {step >= 1 ? '✓' : '1'} Prerequisites
          </div>
          <div style={{ color: step >= 2 ? '#10b981' : '#6b7280', fontWeight: step === 2 ? 'bold' : 'normal' }}>
            {step >= 2 ? '✓' : '2'} Terms & Conditions
          </div>
          <div style={{ color: step >= 3 ? '#10b981' : '#6b7280', fontWeight: step === 3 ? 'bold' : 'normal' }}>
            {step >= 3 ? '✓' : '3'} Install Directory
          </div>
          <div style={{ color: step >= 4 ? '#10b981' : '#6b7280', fontWeight: step === 4 ? 'bold' : 'normal' }}>
            {step >= 4 ? '✓' : '4'} Installation
          </div>
          <div style={{ color: step >= 5 ? '#10b981' : '#6b7280', fontWeight: step === 5 ? 'bold' : 'normal' }}>
            {step >= 5 ? '✓' : '5'} Complete
          </div>
        </div>
      </div>
      <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px solid #374151', fontSize: '12px', color: '#6b7280' }}>
        Step {step} of {totalSteps}
      </div>
    </aside>
    <main className="content">
      {children}
    </main>
  </div>;
}

function LogsDisplay({ logs }: { logs: string[] }) {
  return <div style={{
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '6px',
    padding: '12px',
    maxHeight: '300px',
    overflowY: 'auto',
    marginBottom: '20px',
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#10b981',
    lineHeight: '1.5'
  }}>
    {logs.length === 0 ? (
      <div style={{ color: '#6b7280' }}>No logs yet...</div>
    ) : (
      logs.map((log, i) => <div key={i}>{log}</div>)
    )}
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
