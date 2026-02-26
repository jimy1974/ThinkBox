import dagre from 'dagre';
import { FlowNode, FlowEdge } from '@/types';

const NODE_WIDTH = 280;
const NODE_HEIGHT = 160;

export function applyDagreLayout(
  nodes: FlowNode[],
  edges: FlowEdge[],
  direction: 'TB' | 'LR' = 'TB'
): FlowNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 100,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach(node => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map(node => {
    const pos = g.node(node.id);
    if (!pos) return node; // keep existing position if dagre didn't place it
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });
}

export function buildEdgesFromNodes(nodes: FlowNode[]): FlowEdge[] {
  const edgeColors: Record<string, string> = {
    creator: '#10b981',
    skeptic: '#f59e0b',
    lateral: '#8b5cf6',
    summary: '#3b82f6',
  };

  return nodes
    .filter(n => n.data.parentId != null)
    .map(n => ({
      id: `e-${n.id}`,
      source: n.data.parentId!,
      target: n.id,
      animated: n.data.status === 'generating',
      style: {
        stroke: edgeColors[n.data.agentType] ?? '#6b7280',
        strokeWidth: 2,
      },
    }));
}
