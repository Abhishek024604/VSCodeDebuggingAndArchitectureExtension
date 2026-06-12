/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/webview/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        vscode: {
          bg: 'var(--vscode-editor-background)',
          fg: 'var(--vscode-editor-foreground)',
          border: 'var(--vscode-panel-border)',
          accent: 'var(--vscode-button-background)',
          accentHover: 'var(--vscode-button-hoverBackground)',
        }
      }
    },
  },
  plugins: [],
}
