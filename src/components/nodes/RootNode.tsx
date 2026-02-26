'use client';
import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { FlowNode } from '@/types';

export const RootNode = memo(({ data }: NodeProps) => {
  const d = data as FlowNode['data'];
  return (
    <div className="root-node node-base">
      <div className="node-header root-header">
        <span className="node-icon">🧠</span>
        <span className="node-type-label">Problem</span>
      </div>
      <div className="node-body">
        <p className="node-content-text root-content">{d.label}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </div>
  );
});
RootNode.displayName = 'RootNode';
