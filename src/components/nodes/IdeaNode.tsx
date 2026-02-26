'use client';
import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { FlowNode, AgentType } from '@/types';
import { useStore } from '@/store/useStore';

const AGENT_CONFIG: Record<AgentType, { icon: string; label: string; colorClass: string; headerClass: string }> = {
  root: { icon: '🧠', label: 'Problem', colorClass: 'root-node', headerClass: 'root-header' },
  creator: { icon: '💡', label: 'Creator', colorClass: 'creator-node', headerClass: 'creator-header' },
  skeptic: { icon: '⚠️', label: 'Skeptic', colorClass: 'skeptic-node', headerClass: 'skeptic-header' },
  lateral: { icon: '🔀', label: 'Lateral', colorClass: 'lateral-node', headerClass: 'lateral-header' },
  summary: { icon: '📄', label: 'Summary', colorClass: 'summary-node', headerClass: 'summary-header' },
};

interface StarRatingProps {
  grade: number | null;
  nodeId: string;
}

const StarRating = memo(({ grade, nodeId }: StarRatingProps) => {
  const { updateNodeGrade } = useStore();

  const handleGrade = useCallback(async (star: number) => {
    const newGrade = grade === star ? null : star;
    updateNodeGrade(nodeId, newGrade);
    try {
      await fetch(`/api/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: newGrade }),
      });
    } catch (e) {
      console.error('Failed to save grade', e);
    }
  }, [grade, nodeId, updateNodeGrade]);

  return (
    <div className="star-rating" onClick={e => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => handleGrade(star)}
          className={`star-btn ${(grade ?? 0) >= star ? 'star-filled' : 'star-empty'}`}
          title={`Grade ${star}/5`}
        >
          ★
        </button>
      ))}
    </div>
  );
});
StarRating.displayName = 'StarRating';

export const IdeaNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as FlowNode['data'];
  const { setSelectedNode } = useStore();
  const config = AGENT_CONFIG[d.agentType] ?? AGENT_CONFIG.creator;

  const contentParsed: { title?: string; description?: string } = (() => {
    try { return JSON.parse(d.content); } catch { return { description: d.content }; }
  })();

  const isIgnored = d.status === 'ignored';

  const handleClick = useCallback(() => {
    setSelectedNode(id);
  }, [id, setSelectedNode]);

  const meta = d.metadata || {};
  const confidence = meta.confidence_score as number | undefined;

  return (
    <div
      className={`node-base ${config.colorClass} ${selected ? 'node-selected' : ''} ${isIgnored ? 'node-ignored' : ''}`}
      onClick={handleClick}
    >
      <Handle type="target" position={Position.Top} className="node-handle" />

      <div className={`node-header ${config.headerClass}`}>
        <span className="node-icon">{config.icon}</span>
        <span className="node-type-label">{config.label}</span>
        {confidence !== undefined && (
          <span className="confidence-badge" title="Viability confidence">
            {confidence}%
          </span>
        )}
      </div>

      <div className="node-body">
        {contentParsed.title && (
          <p className="node-title">{contentParsed.title}</p>
        )}
        {contentParsed.description && (
          <p className="node-desc">{contentParsed.description}</p>
        )}
      </div>

      <div className="node-footer">
        <StarRating grade={d.grade} nodeId={id} />
        {isIgnored && <span className="ignored-badge">Ignored</span>}
      </div>

      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </div>
  );
});
IdeaNode.displayName = 'IdeaNode';
