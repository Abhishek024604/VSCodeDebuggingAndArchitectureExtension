import * as vscode from 'vscode';
import { DebugWebviewProvider } from './providers/DebugWebviewProvider';
import { analyzeError } from './services/llm';
import { extractContext } from './services/extractor';

export function activate(context: vscode.ExtensionContext) {
  const provider = new DebugWebviewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DebugWebviewProvider.viewType, provider)
  );

  let analyzeCommand = vscode.commands.registerCommand('debugmind.analyzeSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    
    // First try to get selection from active editor (which might be the terminal if it's focused as text, but usually it's just code)
    // For terminal text selection, VS Code API currently doesn't allow direct text extraction of selection easily 
    // unless we use `vscode.env.clipboard.readText()`. So we will instruct users to copy to clipboard or we read it.
    
    let errorText = '';
    if (editor && !editor.selection.isEmpty) {
      const selection = editor.selection;
      errorText = editor.document.getText(selection);
    } else {
      // Fallback to clipboard
      errorText = await vscode.env.clipboard.readText();
      if (!errorText) {
        vscode.window.showErrorMessage('DebugMind: No error text selected or found in clipboard.');
        return;
      }
    }

    // Show loading state in webview
    provider.startLoading(errorText);

    const activeFilePath = editor ? editor.document.uri.fsPath : null;

    try {
      // 1. Extract context for PRIMARY file ONLY (maxFiles=1, clipLines=true)
      let projectContext = await extractContext(errorText, activeFilePath, 1, true);
      
      // Navigate to the primary file if found
      let diagnosticsText = '';
      if (projectContext.primaryFilePath) {
        try {
          const doc = await vscode.workspace.openTextDocument(projectContext.primaryFilePath);
          const activeEditor = await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.One });
          if (projectContext.primaryLineNumber && projectContext.primaryLineNumber > 0) {
            const pos = new vscode.Position(projectContext.primaryLineNumber - 1, 0);
            activeEditor.selection = new vscode.Selection(pos, pos);
            activeEditor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
          }

          // Get diagnostics for this file
          const diagnostics = vscode.languages.getDiagnostics(doc.uri);
          if (diagnostics.length > 0) {
            diagnosticsText = '\n\nEditor Diagnostics for ' + vscode.workspace.asRelativePath(doc.uri) + ':\n' + diagnostics.map(d => {
              const severityStr = d.severity === 0 ? 'Error' : d.severity === 1 ? 'Warning' : 'Info';
              return `- Line ${d.range.start.line + 1}: [${severityStr}] ${d.message}`;
            }).join('\n');
          }
        } catch (e) {
          console.error("Could not open primary file", e);
        }
      }

      // 2. Call LLM (First Pass)
      let report = await analyzeError(errorText + diagnosticsText, projectContext);
      
      // If confidence is low, pull in dependencies and try again!
      if (report.confidenceScore < 80) {
        provider.startLoading("Confidence is low. Fetching dependency tree...");
        // Re-extract with dependencies (maxFiles=4, clipLines=false to see full context)
        projectContext = await extractContext(errorText, activeFilePath, 4, false);
        report = await analyzeError(errorText + diagnosticsText, projectContext);
      }
      
      // Add dependency tree for UI display only (not sent to LLM)
      report.dependencyTree = projectContext.files.map((f: { path: string }) => f.path);
      
      // 3. Show report
      provider.showReport(report);
    } catch (err: any) {
      vscode.window.showErrorMessage(`DebugMind Error: ${err.message}`);
      provider.showReport({
        rootCause: 'Failed to analyze error.',
        whyItHappened: err.message,
        confidenceScore: 0,
        recommendedFix: 'Please check your API keys in the settings and try again.',
        alternativeFixes: [],
        prevention: 'Ensure network connectivity and valid configuration.'
      });
    }
  });

  context.subscriptions.push(analyzeCommand);
  
  // Command to focus the view
  context.subscriptions.push(
    vscode.commands.registerCommand('debugmind.reportView.focus', () => {
      vscode.commands.executeCommand('debugmind.reportView.focus');
    })
  );
}

export function deactivate() {}
