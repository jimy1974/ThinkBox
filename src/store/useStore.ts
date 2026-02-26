'use client';
import { create } from 'zustand';
import { FlowNode, FlowEdge, PhaseType, DBNode, NodeMetadata } from '@/types';
import { applyDagreLayout, buildEdgesFromNodes } from '@/lib/layout';

interface StoreState {
  sessionId: string | null;
  originalPrompt: string;
  phase: PhaseType;
  phaseMessage: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodeId: string | null;
  deepDiveContent: string | null;
  deepDiveLoading: boolean;
  fitViewTrigger: number;
  isStreaming: boolean;
  statusMessage: string;
  showHistory: boolean;

  // Actions
  initSession: (sessionId: string, prompt: string, rootNode: DBNode) => void;
  setPhase: (phase: PhaseType, message?: string) => void;
  addNode: (dbNode: DBNode) => void;
  updateNodeGrade: (nodeId: string, grade: number | null) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  updateNodeStatus: (nodeId: string, status: string) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setDeepDive: (content: string | null) => void;
  setDeepDiveLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  reLayout: () => void;
  triggerFitView: () => void;
  addChildNodes: (newDbNodes: DBNode[]) => void;
  reset: () => void;
  toggleHistory: () => void;
  setShowHistory: (show: boolean) => void;
}

function dbNodeToFlowNode(dbNode: DBNode): FlowNode {
  const meta: NodeMetadata = (() => {
    try { return JSON.parse(dbNode.metadata || '{}'); } catch { return {}; }
  })();

  const contentParsed: { title?: string; description?: string } = (() => {
    try { return JSON.parse(dbNode.content); } catch { return { description: dbNode.content }; }
  })();

  return {
    id: dbNode.id,
    type: dbNode.agent_type,
    position: { x: dbNode.x_pos || 0, y: dbNode.y_pos || 0 },
    draggable: true,
    data: {
      nodeId: dbNode.id,
      parentId: dbNode.parent_id,
      sessionId: dbNode.session_id,
      agentType: dbNode.agent_type,
      content: dbNode.content,
      metadata: meta,
      grade: dbNode.grade,
      status: dbNode.status,
      label: contentParsed.title || dbNode.content.substring(0, 50),
    },
  };
}

export const useStore = create<StoreState>((set, get) => ({
  sessionId: null,
  originalPrompt: '',
  phase: 'idle',
  phaseMessage: '',
  nodes: [],
  edges: [],
  selectedNodeId: null,
  deepDiveContent: null,
  deepDiveLoading: false,
  isStreaming: false,
  statusMessage: '',
  fitViewTrigger: 0,
  showHistory: false,

  initSession: (sessionId, prompt, rootNode) => {
    const flowNode = dbNodeToFlowNode(rootNode);
    set({
      sessionId,
      originalPrompt: prompt,
      phase: 'idle',
      nodes: [{ ...flowNode, position: { x: 400, y: 50 } }],
      edges: [],
      selectedNodeId: null,
      deepDiveContent: null,
      showHistory: false,
    });
  },

  setPhase: (phase, message = '') => {
    set({ phase, phaseMessage: message, statusMessage: message });
  },

  addNode: (dbNode) => {
    const newFlowNode = dbNodeToFlowNode(dbNode);
    set(state => {
      const updatedNodes = [...state.nodes, newFlowNode];
      const updatedEdges = buildEdgesFromNodes(updatedNodes);
      const laidOut = applyDagreLayout(updatedNodes, updatedEdges);
      return { nodes: laidOut, edges: buildEdgesFromNodes(laidOut) };
    });
  },

  addChildNodes: (newDbNodes) => {
    const newFlowNodes = newDbNodes.map(dbNodeToFlowNode);
    set(state => {
      const updatedNodes = [...state.nodes, ...newFlowNodes];
      const updatedEdges = buildEdgesFromNodes(updatedNodes);
      const laidOut = applyDagreLayout(updatedNodes, updatedEdges);
      return { nodes: laidOut, edges: buildEdgesFromNodes(laidOut) };
    });
  },

  updateNodeGrade: (nodeId, grade) => {
    set(state => ({
      nodes: state.nodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, grade } } : n
      ),
    }));
  },

  updateNodePosition: (nodeId, x, y) => {
    set(state => ({
      nodes: state.nodes.map(n =>
        n.id === nodeId ? { ...n, position: { x, y } } : n
      ),
    }));
  },

  updateNodeStatus: (nodeId, status) => {
    set(state => ({
      nodes: state.nodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, status: status as never } } : n
      ),
    }));
  },

  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId, deepDiveContent: null });
  },

  setDeepDive: (content) => set({ deepDiveContent: content }),
  setDeepDiveLoading: (loading) => set({ deepDiveLoading: loading }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),

  reLayout: () => {
    set(state => {
      const updatedEdges = buildEdgesFromNodes(state.nodes);
      const laidOut = applyDagreLayout(state.nodes, updatedEdges);
      return { nodes: laidOut, edges: buildEdgesFromNodes(laidOut), fitViewTrigger: state.fitViewTrigger + 1 };
    });
  },

  triggerFitView: () => set(state => ({ fitViewTrigger: state.fitViewTrigger + 1 })),

  toggleHistory: () => set(state => ({ showHistory: !state.showHistory })),
  setShowHistory: (show) => set({ showHistory: show }),

  reset: () => set({
    sessionId: null,
    originalPrompt: '',
    phase: 'idle',
    phaseMessage: '',
    nodes: [],
    edges: [],
    selectedNodeId: null,
    deepDiveContent: null,
    deepDiveLoading: false,
    isStreaming: false,
    statusMessage: '',
    fitViewTrigger: 0,
    showHistory: false,
  }),
}));
