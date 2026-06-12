import * as vscode from 'vscode';
import { buildProjectGraph } from '../services/architecture';

export class DebugWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'debugmind.reportView';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'buildArchitecture') {
        webviewView.webview.postMessage({ type: 'architectureLoading' });
        try {
          const data = await buildProjectGraph();
          webviewView.webview.postMessage({ type: 'architectureData', data });
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to build architecture: ${err.message}`);
          webviewView.webview.postMessage({ type: 'architectureFailed' });
        }
      }
    });
  }

  public showReport(report: any) {
    if (this._view) {
      this._view.show?.(true);
      this._view.webview.postMessage({ type: 'analyzeCompleted', report });
    } else {
      // If the view isn't active, we might need to create a panel instead or focus it
      vscode.commands.executeCommand('debugmind.reportView.focus').then(() => {
        setTimeout(() => {
          this._view?.webview.postMessage({ type: 'analyzeCompleted', report });
        }, 500);
      });
    }
  }

  public startLoading(errorText: string) {
    if (this._view) {
      this._view.show?.(true);
      this._view.webview.postMessage({ type: 'analyzeStarted', errorText });
    } else {
      vscode.commands.executeCommand('debugmind.reportView.focus').then(() => {
        setTimeout(() => {
          this._view?.webview.postMessage({ type: 'analyzeStarted', errorText });
        }, 500);
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DebugMind Report</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
