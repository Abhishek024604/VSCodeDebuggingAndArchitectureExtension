import * as vscode from 'vscode';
import { ProjectContext } from './extractor';

export async function analyzeError(errorText: string, context: ProjectContext) {
  const config = vscode.workspace.getConfiguration('debugmind');
  const provider = config.get<string>('llmProvider') || 'groq';
  const customBaseUrl = config.get<string>('baseUrl');
  const configuredModel = config.get<string>('model') || 'llama-3.3-70b-versatile';
  
  let apiKey = '';
  let endpoint = '';
  let model = configuredModel;

  if (provider === 'groq') {
    apiKey = config.get<string>('groqApiKey') || config.get<string>('openrouterApiKey') || '';
    endpoint = customBaseUrl ? `${customBaseUrl}/chat/completions` : 'https://api.groq.com/openai/v1/chat/completions';
  } else if (provider === 'openrouter') {
    apiKey = config.get<string>('openrouterApiKey') || '';
    endpoint = customBaseUrl ? `${customBaseUrl}/chat/completions` : 'https://openrouter.ai/api/v1/chat/completions';
  } else if (provider === 'openai') {
    apiKey = config.get<string>('openaiApiKey') || '';
    endpoint = customBaseUrl ? `${customBaseUrl}/chat/completions` : 'https://api.openai.com/v1/chat/completions';
  } else if (provider === 'anthropic') {
    apiKey = config.get<string>('anthropicApiKey') || '';
    endpoint = customBaseUrl ? `${customBaseUrl}/messages` : 'https://api.anthropic.com/v1/messages';
  } else if (provider === 'local') {
    endpoint = config.get<string>('localEndpoint') || 'http://localhost:11434/api/generate';
  }

  if (provider !== 'local' && !apiKey) {
    throw new Error(`API Key for ${provider} is missing. Please set it in VS Code settings.`);
  }

  const prompt = `You are DebugMind, an expert AI debugging assistant.
Analyze the following error and provide a structured JSON response.

Framework: ${context.framework}

Error Output:
${errorText}

Relevant Files:
${context.files.map(f => `--- ${f.path} ---\n${f.content}\n`).join('\n')}

Respond ONLY with a valid JSON object matching this schema, no markdown blocks around it, just raw JSON:
{
  "rootCause": "Short explanation of the root cause",
  "whyItHappened": "Detailed explanation of why it failed",
  "confidenceScore": 95,
  "recommendedFix": "Code block or specific instruction",
  "alternativeFixes": ["Alternative 1", "Alternative 2"],
  "prevention": "How to prevent this in the future"
}`;

  try {
    if (provider === 'local') {
      // Ollama format (basic)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3', // or user configured
          prompt: prompt,
          stream: false,
          format: 'json'
        })
      });
      const data: any = await response.json();
      return JSON.parse(data.response);
    } else if (provider === 'anthropic') {
      // Anthropic format
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 4096,
          system: 'You are an expert debugger. You only reply with JSON.',
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${await response.text()}`);
      }

      const data: any = await response.json();
      let content = data.content[0].text;
      // Strip markdown JSON wrapping if anthropic included it
      content = content.replace(/^```json\n/, '').replace(/\n```$/, '');
      return JSON.parse(content);
    } else {
      // OpenAI compatible format (Groq/OpenRouter/OpenAI)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...(provider === 'openrouter' ? { 'HTTP-Referer': 'vscode-debugmind', 'X-Title': 'DebugMind' } : {})
        },
        body: JSON.stringify({
          model: model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You are an expert debugger. You only reply with JSON.' },
            { role: 'user', content: prompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${await response.text()}`);
      }

      const data: any = await response.json();
      const content = data.choices[0].message.content;
      return JSON.parse(content);
    }
  } catch (error: any) {
    console.error(error);
    throw new Error(`Failed to communicate with LLM provider: ${error.message}`);
  }
}
