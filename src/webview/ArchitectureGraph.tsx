import React, { useCallback, useEffect, useState, useRef } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Node, 
  Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { Activity, RefreshCw, Download, ChevronDown } from 'lucide-react';
import * as htmlToImage from 'html-to-image';

const dagreGraph = new dagre.graphlib.Graph({ compound: true });
dagreGraph.setGraph({});
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 172;
const nodeHeight = 36;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, compound: true, nodesep: 30, ranksep: 50 });

  nodes.forEach((node) => {
    if (node.type === 'group') {
      dagreGraph.setNode(node.id, {});
    } else {
      dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    }
  });

  nodes.forEach((node) => {
    if (node.parentNode) {
      dagreGraph.setParent(node.id, node.parentNode);
    }
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    let x = nodeWithPosition.x;
    let y = nodeWithPosition.y;

    if (node.type === 'group') {
      node.style = {
        ...node.style,
        width: nodeWithPosition.width,
        height: nodeWithPosition.height,
      };
      x = nodeWithPosition.x - nodeWithPosition.width / 2;
      y = nodeWithPosition.y - nodeWithPosition.height / 2;
    } else {
      x = nodeWithPosition.x - nodeWidth / 2;
      y = nodeWithPosition.y - nodeHeight / 2;
    }

    if (node.parentNode) {
      const parentWithPosition = dagreGraph.node(node.parentNode);
      const parentX = parentWithPosition.x - parentWithPosition.width / 2;
      const parentY = parentWithPosition.y - parentWithPosition.height / 2;
      x -= parentX;
      y -= parentY;
      
      // Add some padding inside group
      x += 10;
      y += 30; 
    }

    node.targetPosition = isHorizontal ? 'left' : 'top' as any;
    node.sourcePosition = isHorizontal ? 'right' : 'bottom' as any;
    node.position = { x, y };

    return node;
  });

  return { nodes, edges };
};

export default function ArchitectureGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const requestArchitecture = useCallback(() => {
    setLoading(true);
    try {
      // @ts-ignore
      const vscode = (window as any).vscodeApi || acquireVsCodeApi();
      vscode.postMessage({ type: 'buildArchitecture' });
      // @ts-ignore
      (window as any).vscodeApi = vscode;
    } catch (e) {
      console.warn('Could not acquire vscode api');
    }
  }, []);

  const downloadImage = useCallback(() => {
    setDropdownOpen(false);
    if (reactFlowWrapper.current === null) return;

    htmlToImage.toPng(reactFlowWrapper.current.querySelector('.react-flow__viewport') as HTMLElement, {
      backgroundColor: '#1e1e1e',
    }).then((dataUrl) => {
      const a = document.createElement('a');
      a.setAttribute('download', 'architecture-graph.png');
      a.setAttribute('href', dataUrl);
      a.click();
    });
  }, []);

  const downloadMarkdown = useCallback(() => {
    setDropdownOpen(false);
    let md = '# Project Architecture\n\n## Components\n';
    
    // Group files by parent directory
    const groups: Record<string, string[]> = {};
    nodes.filter(n => n.type !== 'group').forEach(n => {
      const groupName = n.parentNode ? n.parentNode.replace('group:', '') : 'Root';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(n.data.label);
    });

    for (const [group, files] of Object.entries(groups)) {
      md += `\n### ${group}\n`;
      files.forEach(f => md += `- ${f}\n`);
    }

    md += '\n## Dependencies\n';
    edges.forEach(e => {
      const sourceLabel = nodes.find(n => n.id === e.source)?.data?.label || e.source;
      const targetLabel = nodes.find(n => n.id === e.target)?.data?.label || e.target;
      md += `- ${sourceLabel} -> ${targetLabel}\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('download', 'architecture-graph.md');
    a.setAttribute('href', url);
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'architectureLoading') {
        setLoading(true);
      } else if (message.type === 'architectureData') {
        setLoading(false);
        setHasData(true);
        
        const rawNodes = message.data.nodes.map((n: any) => {
          if (n.type === 'group') {
            return {
              id: n.id,
              type: 'group',
              position: { x: 0, y: 0 },
              style: {
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed #555',
                borderRadius: '8px',
                zIndex: -1,
              },
              data: { label: n.label }
            };
          }

          let bgColor = '#1e1e1e';
          let textColor = '#d4d4d4';
          let borderColor = '#333';

          if (n.label.endsWith('.tsx') || n.label.endsWith('.jsx')) {
            bgColor = 'rgba(16, 185, 129, 0.1)'; // Green for UI
            borderColor = 'rgba(16, 185, 129, 0.3)';
          } else if (n.label.endsWith('.ts') || n.label.endsWith('.js')) {
            bgColor = 'rgba(59, 130, 246, 0.1)'; // Blue for Logic
            borderColor = 'rgba(59, 130, 246, 0.3)';
          } else if (n.label.endsWith('.py')) {
            bgColor = 'rgba(245, 158, 11, 0.1)'; // Yellow/Orange for Python
            borderColor = 'rgba(245, 158, 11, 0.3)';
          }

          return {
            id: n.id,
            parentNode: n.parentNode,
            extent: n.parentNode ? 'parent' : undefined,
            data: { label: n.label },
            position: { x: 0, y: 0 },
            style: {
              background: bgColor,
              color: textColor,
              border: `1px solid ${borderColor}`,
              borderRadius: '4px',
              fontSize: '12px',
              padding: '8px',
              width: nodeWidth,
              height: nodeHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }
          };
        });

        const rawEdges = message.data.edges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#888',
          },
          style: { stroke: '#888' }
        }));

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          rawNodes,
          rawEdges,
          'LR'
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
      } else if (message.type === 'architectureFailed') {
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (!(window as any).vscodeApi) {
      try {
        // @ts-ignore
        (window as any).vscodeApi = acquireVsCodeApi();
      } catch (e) {}
    }
  }, []);

  return (
    <div className="flex flex-col h-screen w-full relative">
      <div className="flex items-center justify-between p-4 bg-vscode-editor-background border-b border-vscode-panel-border z-10">
        <div>
          <p className="text-sm opacity-80 mb-2">Made any changes to files and folders?</p>
          <button 
            onClick={requestArchitecture}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors disabled:opacity-50"
          >
            {loading ? <Activity className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {hasData ? 'Rebuild Architecture' : 'Build Architecture'}
          </button>
        </div>
        
        {hasData && (
          <div className="relative">
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white border border-[#444] rounded text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
              <ChevronDown className="w-4 h-4" />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#2d2d2d] border border-[#444] rounded shadow-lg overflow-hidden z-50">
                <button 
                  onClick={downloadImage}
                  className="w-full text-left px-4 py-2 hover:bg-blue-600 transition-colors text-sm"
                >
                  Download as Image (.png)
                </button>
                <button 
                  onClick={downloadMarkdown}
                  className="w-full text-left px-4 py-2 hover:bg-blue-600 transition-colors text-sm"
                >
                  Download as Markdown (.md)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 w-full bg-[#1e1e1e]" ref={reactFlowWrapper}>
        {hasData ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            minZoom={0.1}
            attributionPosition="bottom-right"
          >
            <Background color="#333" gap={16} />
            <Controls />
          </ReactFlow>
        ) : (
          <div className="flex items-center justify-center h-full text-center p-8 opacity-60">
            {loading ? 'Scanning workspace...' : 'Click "Build Architecture" to scan your workspace and generate a dependency graph.'}
          </div>
        )}
      </div>
    </div>
  );
}
