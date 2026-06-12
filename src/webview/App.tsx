import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Lightbulb, Activity, FileCode2, Bug, Network } from 'lucide-react';
import ArchitectureGraph from './ArchitectureGraph';

interface DebugReport {
  rootCause: string;
  whyItHappened: string;
  confidenceScore: number;
  recommendedFix: string;
  alternativeFixes: string[];
  prevention: string;
  dependencyTree?: string[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'debug' | 'architecture'>('debug');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [report, setReport] = useState<DebugReport | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'analyzeStarted':
          setActiveTab('debug');
          setLoading(true);
          setReport(null);
          setErrorText(message.errorText);
          break;
        case 'analyzeCompleted':
          setLoading(false);
          setReport(message.report);
          break;
        case 'analyzeFailed':
          setLoading(false);
          setReport(null);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-vscode-editor-background text-vscode-editor-foreground">
      {/* Tab Navigation */}
      <div className="flex items-center border-b border-vscode-panel-border px-2 py-1 bg-[#1e1e1e] sticky top-0 z-50">
        <button
          onClick={() => setActiveTab('debug')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
            activeTab === 'debug'
              ? 'bg-vscode-editor-background text-blue-400 font-medium'
              : 'hover:bg-white/5 opacity-70'
          }`}
        >
          <Bug className="w-4 h-4" />
          Debug Report
        </button>
        <button
          onClick={() => setActiveTab('architecture')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ml-1 ${
            activeTab === 'architecture'
              ? 'bg-vscode-editor-background text-blue-400 font-medium'
              : 'hover:bg-white/5 opacity-70'
          }`}
        >
          <Network className="w-4 h-4" />
          Architecture
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'debug' ? (
          <div className="p-6 max-w-4xl mx-auto space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-4">
                <Activity className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-lg font-medium">DebugMind is analyzing...</p>
              </div>
            ) : !report ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-4 p-8 text-center opacity-70">
                <Lightbulb className="w-12 h-12" />
                <h2 className="text-xl font-semibold">Welcome to DebugMind</h2>
                <p>Select an error in your terminal or editor, right-click, and choose "DebugMind: Analyze Selected Error".</p>
              </div>
            ) : (
              <>
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                  <h3 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" /> Root Cause
                  </h3>
                  <p>{report.rootCause}</p>
                </div>

                <div className="bg-vscode-editor-background border border-vscode-panel-border p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Why It Happened</h3>
                  <p className="opacity-90">{report.whyItHappened}</p>
                </div>

                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                  <h3 className="text-green-400 font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" /> Recommended Fix
                  </h3>
                  <pre className="bg-black/20 p-4 rounded max-h-80 overflow-y-auto whitespace-pre-wrap break-words">
                    <code>{report.recommendedFix}</code>
                  </pre>
                </div>

                {report.alternativeFixes && report.alternativeFixes.length > 0 && (
                  <div className="bg-vscode-editor-background border border-vscode-panel-border p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Alternative Fixes</h3>
                    <ul className="list-disc pl-5 space-y-2 opacity-90">
                      {report.alternativeFixes.map((fix, idx) => (
                        <li key={idx}>{fix}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                  <h3 className="text-blue-400 font-semibold mb-2">Prevention</h3>
                  <p>{report.prevention}</p>
                </div>

                {report.dependencyTree && report.dependencyTree.length > 0 && (
                  <div className="bg-vscode-editor-background border border-vscode-panel-border p-4 rounded-lg mt-6">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <FileCode2 className="w-5 h-5" /> Dependency Tree Used for Context
                    </h3>
                    <p className="text-sm opacity-70 mb-2">The following files were included in the analysis:</p>
                    <ul className="list-disc pl-5 space-y-1 opacity-90 font-mono text-sm">
                      {report.dependencyTree.map((file, idx) => (
                        <li key={idx}>{file}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <ArchitectureGraph />
        )}
      </div>
    </div>
  );
}
