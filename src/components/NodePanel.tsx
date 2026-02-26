'use client';
import { useState, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { FlowNode } from '@/types';

export default function NodePanel() {
  const {
    selectedNodeId, nodes, sessionId,
    setDeepDive, setDeepDiveLoading, setSelectedNode,
    addChildNodes, updateNodeStatus, deepDiveLoading,
  } = useStore();

  const [expandLoading, setExpandLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) as FlowNode | undefined;

  const handleAction = useCallback(async (action: 'expand' | 'deep_dive' | 'ignore') => {
    if (!selectedNodeId) return;
    setError(null);

    try {
      if (action === 'expand') {
        setExpandLoading(true);
        const res = await fetch(`/api/nodes/${selectedNodeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'expand' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Expand failed');
        addChildNodes(data.nodes);
      }

      if (action === 'deep_dive') {
        setDeepDiveLoading(true);
        const res = await fetch(`/api/nodes/${selectedNodeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'deep_dive' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Deep dive failed');
        setDeepDive(data.deepDive.full_markdown_content);
      }

      if (action === 'ignore') {
        updateNodeStatus(selectedNodeId, 'ignored');
        await fetch(`/api/nodes/${selectedNodeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ignore' }),
        });
        setSelectedNode(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExpandLoading(false);
      setDeepDiveLoading(false);
    }
  }, [selectedNodeId, addChildNodes, setDeepDive, setDeepDiveLoading, updateNodeStatus, setSelectedNode]);

  if (!selectedNode) return null;

  const d = selectedNode.data;
  const contentParsed: { title?: string; description?: string } = (() => {
    try { return JSON.parse(d.content); } catch { return { description: d.content }; }
  })();

  const agentColors: Record<string, string> = {
    creator: '#10b981', skeptic: '#f59e0b', lateral: '#8b5cf6',
    summary: '#3b82f6', root: '#64748b',
  };
  const accentColor = agentColors[d.agentType] ?? '#6b7280';

  const agentLabels: Record<string, string> = {
    creator: '💡 Creator Idea', skeptic: '⚠️ Skeptic Warning',
    lateral: '🔀 Lateral Alternative', summary: '📄 Summary', root: '🧠 Root Problem',
  };

  const isRoot = d.agentType === 'root';
  const isIgnored = d.status === 'ignored';

  return (
    <div className="node-panel" style={{ borderTopColor: accentColor }}>
      <div className="node-panel-header">
        <div>
          <div className="node-panel-type" style={{ color: accentColor }}>
            {agentLabels[d.agentType] ?? d.agentType}
          </div>
          {d.grade && (
            <div className="node-panel-grade">
              {'★'.repeat(d.grade)}{'☆'.repeat(5 - d.grade)} ({d.grade}/5)
            </div>
          )}
        </div>
        <button className="close-btn" onClick={() => setSelectedNode(null)}>✕</button>
      </div>

      {contentParsed.title && (
        <h3 className="node-panel-title">{contentParsed.title}</h3>
      )}

      {contentParsed.description && (
        <p className="node-panel-desc">{contentParsed.description}</p>
      )}

      {d.metadata?.confidence_score !== undefined && (
        <div className="confidence-bar-wrap">
          <div className="confidence-bar-label">
            Viability: {d.metadata.confidence_score}%
          </div>
          <div className="confidence-bar-bg">
            <div
              className="confidence-bar-fill"
              style={{
                width: `${d.metadata.confidence_score}%`,
                backgroundColor: d.metadata.confidence_score > 70 ? '#10b981'
                  : d.metadata.confidence_score > 40 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
        </div>
      )}

      {d.metadata?.tags && d.metadata.tags.length > 0 && (
        <div className="tags-row">
          {d.metadata.tags.map((tag: string) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      )}

      {error && <div className="error-msg">⚠ {error}</div>}

      {!isRoot && !isIgnored && (
        <div className="action-btns">
          <button
            className="action-btn action-btn-expand"
            onClick={() => handleAction('expand')}
            disabled={expandLoading || deepDiveLoading}
          >
            {expandLoading ? '⏳ Expanding...' : '🌿 Expand Further'}
          </button>

          <button
            className="action-btn action-btn-dive"
            onClick={() => handleAction('deep_dive')}
            disabled={expandLoading || deepDiveLoading}
          >
            {deepDiveLoading ? '⏳ Researching...' : '🔬 Deep Dive Report'}
          </button>

          <button
            className="action-btn action-btn-ignore"
            onClick={() => handleAction('ignore')}
            disabled={expandLoading || deepDiveLoading}
          >
            🚫 Ignore This Branch
          </button>
        </div>
      )}

      {isIgnored && (
        <div className="ignored-notice">This branch has been ignored.</div>
      )}
    </div>
  );
}
