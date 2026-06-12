import * as vscode from 'vscode';
import * as path from 'path';

export interface GraphNode {
  id: string;
  label: string;
  parentNode?: string;
  type?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface ArchitectureData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export async function buildProjectGraph(): Promise<ArchitectureData> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  
  if (!vscode.workspace.workspaceFolders) {
    return { nodes, edges };
  }

  const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  
  // Find all code files, excluding node_modules and dist
  const files = await vscode.workspace.findFiles('**/*.{js,jsx,ts,tsx,py,go,java,cpp,c,rs}', '{**/node_modules/**,**/dist/**,**/build/**,**/out/**,**/.git/**}');
  
  const nodesSet = new Set<string>();
  const edgesSet = new Set<string>();
  const groupsSet = new Set<string>();

  // Extensions to try for local imports
  const extensions = ['', '.ts', '.js', '.tsx', '.jsx', '/index.ts', '/index.js', '.py'];
  
  // Helper to normalize path relative to workspace root
  const normalizeId = (filePath: string) => {
    return vscode.workspace.asRelativePath(filePath, false).replace(/\\/g, '/');
  };

  const workspaceFiles = new Set<string>(files.map(f => f.fsPath));

  for (const fileUri of files) {
    const filePath = fileUri.fsPath;
    const sourceId = normalizeId(filePath);
    
    // Determine the parent directory group
    const dirPath = path.dirname(filePath);
    const dirRelative = normalizeId(dirPath);
    const parentId = dirRelative === '.' || dirRelative === sourceId ? undefined : `group:${dirRelative}`;

    // Add group node if it doesn't exist
    if (parentId && !groupsSet.has(parentId)) {
      nodes.push({ 
        id: parentId, 
        label: dirRelative,
        type: 'group'
      });
      groupsSet.add(parentId);
    }
    
    if (!nodesSet.has(sourceId)) {
      nodes.push({ id: sourceId, label: path.basename(filePath), parentNode: parentId });
      nodesSet.add(sourceId);
    }

    try {
      const contentBuffer = await vscode.workspace.fs.readFile(fileUri);
      const content = Buffer.from(contentBuffer).toString('utf8');
      
      const ext = path.extname(filePath);

      let resolvedTargets: string[] = [];

      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        const importRegex = /(?:import|require)[^'"]*?['"](\.[^'"]+)['"]/g;
        let importMatch;
        while ((importMatch = importRegex.exec(content)) !== null) {
          const depPath = importMatch[1];
          const absoluteBase = path.resolve(path.dirname(filePath), depPath);
          for (const ext of extensions) {
            const testPath = absoluteBase + ext;
            if (workspaceFiles.has(testPath)) {
              resolvedTargets.push(testPath);
              break;
            }
          }
        }
      } else if (ext === '.py') {
        const pyRegex = /(?:import|from)\s+([a-zA-Z0-9_.]+)/g;
        let pyMatch;
        while ((pyMatch = pyRegex.exec(content)) !== null) {
          const modName = pyMatch[1].replace(/\./g, '/');
          const absoluteBase = path.join(rootPath, modName);
          for (const pyExt of ['', '.py', '/__init__.py']) {
            const testPath = absoluteBase + pyExt;
            if (workspaceFiles.has(testPath)) {
              resolvedTargets.push(testPath);
              break;
            }
          }
        }
      }
      
      for (const resolvedPath of resolvedTargets) {
        const targetId = normalizeId(resolvedPath);
        
        const targetDir = path.dirname(resolvedPath);
        const targetDirRelative = normalizeId(targetDir);
        const targetParentId = targetDirRelative === '.' || targetDirRelative === targetId ? undefined : `group:${targetDirRelative}`;

        if (targetParentId && !groupsSet.has(targetParentId)) {
          nodes.push({ id: targetParentId, label: targetDirRelative, type: 'group' });
          groupsSet.add(targetParentId);
        }

        if (!nodesSet.has(targetId)) {
          nodes.push({ id: targetId, label: path.basename(resolvedPath), parentNode: targetParentId });
          nodesSet.add(targetId);
        }

        const edgeId = `${sourceId}->${targetId}`;
        if (!edgesSet.has(edgeId)) {
          edges.push({ id: edgeId, source: sourceId, target: targetId });
          edgesSet.add(edgeId);
        }
      }
    } catch (e) {
      console.warn(`Could not read file for architecture graph: ${filePath}`, e);
    }
  }

  return { nodes, edges };
}
