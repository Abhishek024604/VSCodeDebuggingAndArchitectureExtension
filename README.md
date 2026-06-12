# DebugMind

**DebugMind** is an AI-powered debugging assistant and architecture visualization tool for Visual Studio Code. It seamlessly integrates into your development workflow to analyze errors, explain their root causes, and recommend precise fixes based on the context of your codebase.

![DebugMind Architecture](resources/icon.svg) *(If you have an icon or screenshot, place it in `resources/`!)*

## 🚀 Features

- **Instant Error Analysis**: Highlight an error in your terminal or code editor and hit a shortcut to get an AI-generated debug report.
- **Deep Codebase Context**: DebugMind automatically traces your file imports to understand the dependency tree, ensuring the AI's fixes are tailored to your specific project rather than generic suggestions.
- **Enterprise-Level Architecture Graph**: Visualize your entire project's architecture. Files are automatically grouped by directory and color-coded by responsibility (UI components, Logic/Services, Python scripts, Config).
- **Export Architecture**: Easily download your project's dependency graph as a PNG image or a structured Markdown file for documentation.
- **Multiple LLM Providers**: Bring your own API keys. Supports OpenRouter, Groq, and local models (like Ollama) for complete privacy.

## 📥 Installation

Because DebugMind is not yet on the official VS Code Extension Marketplace, you can install it manually in two ways:

**Method 1: Install via VSIX (Recommended)**
1. Go to the **Releases** page of this GitHub repository.
2. Download the `debugmind-0.0.1.vsix` file.
3. Open VS Code, go to the Extensions view (`Ctrl+Shift+X`).
4. Click the **`...`** (Views and More Actions) menu at the top right of the Extensions panel.
5. Select **Install from VSIX...** and choose the downloaded file.

**Method 2: Install from Source**
1. Clone this repository: `git clone https://github.com/yourusername/debugmind.git`
2. Open the folder in VS Code.
3. Open a terminal and run `npm install`.
4. Run `npm run build` to compile the extension.
5. Press `F5` to launch a new VS Code window with the extension loaded.

## 🛠️ How It Works

### Debugging
1. Encounter an error in your VS Code terminal or editor.
2. Select the error text.
3. Press `Ctrl+Alt+D` (or `Cmd+Alt+D` on Mac) OR right-click and select **"DebugMind: Analyze Selected Error"**.
4. The DebugMind panel will open and provide:
   - The Root Cause
   - Why it happened
   - A Recommended Fix (with code blocks)
   - Alternative Fixes and Prevention tips
   - The specific dependency tree it used for context

### Architecture Visualization
1. Open the DebugMind panel.
2. Switch to the **Architecture** tab.
3. Click **Build Architecture** to scan your workspace.
4. Use the **Download** dropdown to export the graph as `.png` or `.md`.

## ⚙️ Configuration & API Keys

To use the AI features, you must configure an LLM provider in your VS Code settings.

Go to **File > Preferences > Settings** (or press `Ctrl+,`), search for `DebugMind`, and configure the following:

| Setting | Description |
|---------|-------------|
| `debugmind.llmProvider` | Choose your provider: `openrouter`, `groq`, `openai`, `anthropic`, or `local`. |
| `debugmind.model` | The specific model to use (e.g., `gpt-4o`, `claude-3-5-sonnet-20240620`, `llama-3.3-70b-versatile`). |
| `debugmind.openaiApiKey` | Your API key if using native OpenAI. Get one at [platform.openai.com](https://platform.openai.com/). |
| `debugmind.anthropicApiKey` | Your API key if using native Anthropic. Get one at [console.anthropic.com](https://console.anthropic.com/). |
| `debugmind.groqApiKey` | Your API key if using Groq. Get one at [console.groq.com](https://console.groq.com/). |
| `debugmind.openrouterApiKey` | Your API key if using OpenRouter. Get one at [openrouter.ai](https://openrouter.ai/). |
| `debugmind.localEndpoint` | The endpoint for local models (e.g., `http://localhost:11434/api/generate` if running Ollama). |
| `debugmind.baseUrl` | Optional: Custom Base URL if you are using an OpenAI-compatible API. |

### Running Local Models (Ollama)
If you prioritize privacy and want to run models locally on your machine:
1. Install [Ollama](https://ollama.com/).
2. Run a model (e.g., `ollama run llama3`).
3. Set `debugmind.llmProvider` to `local`.
4. Ensure `debugmind.localEndpoint` points to your Ollama API.

## 💻 Development

If you'd like to build the extension locally or contribute:

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run watch` to compile the webview and extension code continuously.
4. Press `F5` in VS Code to launch the Extension Development Host.

## 📝 License

This project is licensed under the [MIT License](LICENSE).
