'use client';
import { useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges,
  Node, Edge, useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '@/store/useStore';
import { IdeaNode } from './nodes/IdeaNode';
import { RootNode } from './nodes/RootNode';
import { FlowNode, FlowEdge, DBNode } from '@/types';

const NODE_TYPES = {
  root: RootNode,
  creator: IdeaNode,
  skeptic: IdeaNode,
  lateral: IdeaNode,
  summary: IdeaNode,
};

// Inner component — must be inside ReactFlowProvider to use useReactFlow
function FlowCanvas() {
  const {
    nodes, edges, sessionId, isStreaming, fitViewTrigger,
    addNode, setPhase, setStreaming, updateNodePosition, triggerFitView,
  } = useStore();

  const { fitView } = useReactFlow();
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fit view whenever fitViewTrigger increments
  useEffect(() => {
    if (fitViewTrigger === 0) return;
    setTimeout(() => fitView({ padding: 0.15, maxZoom: 1.2, duration: 500 }), 50);
  }, [fitViewTrigger, fitView]);

  // Auto-fit after stream completes
  useEffect(() => {
    if (!isStreaming && nodes.length > 1) {
      setTimeout(() => fitView({ padding: 0.15, maxZoom: 1.0, duration: 600 }), 200);
    }
  }, [isStreaming]);

  // Start SSE stream when session is created
  useEffect(() => {
    if (!sessionId || isStreaming || nodes.length === 0) return;
    if (nodes.some(n => n.data.agentType !== 'root')) return; // already has ideas

    const es = new EventSource(`/api/sessions/${sessionId}/stream`);
    eventSourceRef.current = es;
    setStreaming(true);

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);

        if (parsed.type === 'node_created') {
          addNode(parsed.data as DBNode);
        } else if (parsed.type === 'phase_changed') {
          setPhase(parsed.data.phase, parsed.data.message);
        } else if (parsed.type === 'existing_nodes') {
          const existingNodes: DBNode[] = parsed.data;
          existingNodes.forEach(n => {
            if (n.agent_type !== 'root') addNode(n);
          });
          setPhase('complete', 'Loaded existing session');
          setStreaming(false);
          es.close();
        } else if (parsed.type === 'complete') {
          setStreaming(false);
          es.close();
        } else if (parsed.type === 'error') {
          console.error('Stream error:', parsed.data.message);
          setStreaming(false);
          es.close();
        }
      } catch (e) {
        console.error('SSE parse error', e);
      }
    };

    es.onerror = () => {
      setStreaming(false);
      es.close();
    };

    return () => {
      es.close();
      setStreaming(false);
    };
  }, [sessionId]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const { nodes: currentNodes } = useStore.getState();
      const updated = applyNodeChanges(changes, currentNodes as Node[]);
      useStore.setState({ nodes: updated as FlowNode[] });

      // Persist position changes on drag end
      changes.forEach(change => {
        if (change.type === 'position' && change.position && !change.dragging) {
          updateNodePosition(change.id, change.position.x, change.position.y);
          fetch(`/api/nodes/${change.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x_pos: change.position.x, y_pos: change.position.y }),
          }).catch(console.error);
        }
      });
    },
    [updateNodePosition]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const { edges: currentEdges } = useStore.getState();
      const updated = applyEdgeChanges(changes, currentEdges as Edge[]);
      useStore.setState({ edges: updated as FlowEdge[] });
    },
    []
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes as Node[]}
        edges={edges as Edge[]}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.0 }}
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { strokeWidth: 2 },
        }}
        attributionPosition="bottom-left"
      >
        <Background color="#1e293b" gap={20} size={1} />
        <Controls className="flow-controls" />
        <MiniMap
          nodeColor={(n) => {
            const colorMap: Record<string, string> = {
              root: '#334155',
              creator: '#10b981',
              skeptic: '#f59e0b',
              lateral: '#8b5cf6',
              summary: '#3b82f6',
            };
            return colorMap[n.type ?? 'creator'] ?? '#6b7280';
          }}
          className="flow-minimap"
          maskColor="rgba(15, 23, 42, 0.7)"
        />
      </ReactFlow>
    </div>
  );
}

// Outer component wraps with ReactFlowProvider (required for useReactFlow)
export default function BrainstormCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
