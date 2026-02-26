export type AgentType = 'root' | 'creator' | 'skeptic' | 'lateral' | 'summary';

export type NodeStatus = 'pending' | 'generating' | 'complete' | 'ignored';

export type PhaseType = 'idle' | 'generating' | 'critiquing' | 'evolving' | 'complete';

export interface DBNode {
  id: string;
  session_id: string;
  parent_id: string | null;
  agent_type: AgentType;
  content: string;
  metadata: string; // JSON string
  grade: number | null;
  status: NodeStatus;
  x_pos: number;
  y_pos: number;
  created_at: string;
}

export interface NodeMetadata {
  confidence_score?: number;
  search_results?: SearchResult[];
  tags?: string[];
  critique_target?: string;
  iteration?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface DBSession {
  id: string;
  user_id: string;
  original_prompt: string;
  phase: PhaseType;
  created_at: string;
}

export interface DBDeepDive {
  id: string;
  node_id: string;
  full_markdown_content: string;
  created_at: string;
}

export interface FlowNode {
  id: string;
  type: AgentType;
  position: { x: number; y: number };
  draggable?: boolean;
  data: {
    nodeId: string;
    parentId: string | null;
    sessionId: string;
    agentType: AgentType;
    content: string;
    metadata: NodeMetadata;
    grade: number | null;
    status: NodeStatus;
    label: string;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  style?: Record<string, string | number>;
}

export interface StreamEvent {
  type: 'node_created' | 'node_updated' | 'phase_changed' | 'error' | 'complete';
  data: Partial<DBNode> & { phase?: PhaseType; message?: string };
}
