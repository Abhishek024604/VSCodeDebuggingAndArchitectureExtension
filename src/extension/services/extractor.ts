import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface ProjectContext {
  files: { path: string; content: string }[];
  framework: string;
  primaryFilePath?: string;
  primaryLineNumber?: number;
}

export async function extractContext(
  errorText: string, 
  activeFilePath?: string | null,
  maxFilesLimit: number = 4,
  clipLines: boolean = true
): Promise<ProjectContext> {
  const context: ProjectContext = {
    files: [],
    framework: 'Unknown'
  };

  if (!vscode.workspace.workspaceFolders) {
    return context;
  }

  const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

  // 1. Detect Framework
  const packageJsonPath = path.join(rootPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg.dependencies?.next) context.framework = 'Next.js';
      else if (pkg.dependencies?.react) context.framework = 'React';
      else if (pkg.dependencies?.express) context.framework = 'Express';
      else if (pkg.dependencies?.['@nestjs/core']) context.framework = 'NestJS';
      else context.framework = 'Node.js';
    } catch (e) {
      // Ignore parse errors
    }
  }

  const fileToLineMap = new Map<string, number>();
  let primaryFilePath: string | undefined;
  let primaryLineNumber: number | undefined;

  // 2. Extract file paths and line numbers from stack trace
  // Match absolute paths
  const absoluteRegex = /((?:[a-zA-Z]:\\|\/)[^\s()]+?):(\d+)(?::\d+)?/g;
  let match;
  while ((match = absoluteRegex.exec(errorText)) !== null) {
    const filePath = match[1];
    const lineNumber = parseInt(match[2], 10);
    if (filePath.startsWith(rootPath) && fs.existsSync(filePath)) {
      if (!primaryFilePath) {
        primaryFilePath = filePath;
        primaryLineNumber = lineNumber;
      }
      if (!fileToLineMap.has(filePath)) {
        fileToLineMap.set(filePath, lineNumber);
      }
    }
  }

  // Match relative filenames like HostCard.jsx:10
  const relativeRegex = /([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+):(\d+)(?::\d+)?/g;
  while ((match = relativeRegex.exec(errorText)) !== null) {
    const filename = match[1];
    const lineNumber = parseInt(match[2], 10);
    
    // Check if it's already an absolute path matched earlier
    if (filename.includes('/') || filename.includes('\\')) continue;
    
    // Search workspace for this filename
    const files = await vscode.workspace.findFiles(`**/${filename}`, '**/node_modules/**', 1);
    if (files.length > 0) {
      const filePath = files[0].fsPath;
      if (!primaryFilePath) {
        primaryFilePath = filePath;
        primaryLineNumber = lineNumber;
      }
      if (!fileToLineMap.has(filePath)) {
        fileToLineMap.set(filePath, lineNumber);
      }
    }
  }

  context.primaryFilePath = primaryFilePath;
  context.primaryLineNumber = primaryLineNumber;

  // Include active file if provided
  if (activeFilePath && fs.existsSync(activeFilePath)) {
    if (!fileToLineMap.has(activeFilePath)) {
      // If we don't know the exact line for this file, just use -1
      fileToLineMap.set(activeFilePath, -1);
    }
  }

  // Set up the queue for processing files (primary trace files first)
  const filesToProcess = Array.from(fileToLineMap.keys());
  const processedFiles = new Set<string>();
  let count = 0;

  // Extensions to try for local imports
  const extensions = ['', '.ts', '.js', '.tsx', '.jsx', '/index.ts', '/index.js'];

  // Process files (including dependencies)
  for (let i = 0; i < filesToProcess.length; i++) {
    if (count >= maxFilesLimit) break;
    
    const filePath = filesToProcess[i];
    if (processedFiles.has(filePath)) continue;
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Inject error marker if a line number is known
      const errorLine = fileToLineMap.get(filePath);
      if (errorLine && errorLine > 0) {
        const lines = content.split('\n');
        if (errorLine <= lines.length) {
          lines[errorLine - 1] += ' // <--- ERROR HAPPENED AROUND HERE';
          
          if (clipLines) {
            // Clip to ±50 lines around the error
            const start = Math.max(0, errorLine - 50);
            const end = Math.min(lines.length, errorLine + 50);
            content = lines.slice(start, end).join('\n');
          } else {
            content = lines.join('\n');
          }
        }
      } else if (clipLines && count === 0) {
         // If primary file has no known line, we still send it all, or maybe we shouldn't clip.
      }

      context.files.push({ path: vscode.workspace.asRelativePath(filePath), content });
      processedFiles.add(filePath);
      count++;

      // 3. Dependency Parsing (Only local imports like './utils' or '../services/db')
      const importRegex = /(?:import|require)[^'"]*?['"](\.[^'"]+)['"]/g;
      let importMatch;
      while ((importMatch = importRegex.exec(content)) !== null) {
        const depPath = importMatch[1];
        const absoluteBase = path.resolve(path.dirname(filePath), depPath);
        
        // Try to resolve the actual file with extensions
        let resolvedPath = null;
        for (const ext of extensions) {
          const testPath = absoluteBase + ext;
          if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
            resolvedPath = testPath;
            break;
          }
        }

        if (resolvedPath && !processedFiles.has(resolvedPath) && !filesToProcess.includes(resolvedPath)) {
          // Avoid node_modules which shouldn't happen with relative paths but just in case
          if (!resolvedPath.includes('node_modules')) {
            filesToProcess.push(resolvedPath);
          }
        }
      }
    } catch (e) {
      // ignore read errors
    }
  }

  return context;
}
