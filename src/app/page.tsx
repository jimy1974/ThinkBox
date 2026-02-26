'use client';
import dynamic from 'next/dynamic';
import { useStore } from '@/store/useStore';
import Toolbar from '@/components/Toolbar';
import NodePanel from '@/components/NodePanel';
import DeepDivePanel from '@/components/DeepDivePanel';
import ProblemForm from '@/components/ProblemForm';
import PhaseBar from '@/components/PhaseBar';
import SessionHistoryPanel from '@/components/SessionHistoryPanel';

// Dynamically import the canvas to avoid SSR issues with React Flow
const BrainstormCanvas = dynamic(() => import('@/components/BrainstormCanvas'), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#64748b', fontSize: 14 }}>Loading canvas...</div>
    </div>
  ),
});

const LEGEND = [
  { color: '#1f2937', label: '🧠 Problem (Root)' },
  { color: '#10b981', label: '💡 Creator Idea' },
  { color: '#f59e0b', label: '⚠️ Skeptic Critique' },
  { color: '#8b5cf6', label: '🔀 Lateral Alternative' },
];

export default function Home() {
  const { sessionId, deepDiveContent, phase } = useStore();

  return (
    <div className="app-shell">
      {/* Toolbar (shown when session is active) */}
      <Toolbar />

      {/* Phase progress bar */}
      {sessionId && phase !== 'idle' && <PhaseBar />}

      <div className="canvas-area">
        {/* Main canvas — ReactFlowProvider is inside BrainstormCanvas (ssr: false) */}
        <div className="canvas-wrap">
          <BrainstormCanvas />

          {/* Problem form overlay */}
          {!sessionId && <ProblemForm />}

          {/* Legend */}
          {sessionId && (
            <div className="legend">
              <div className="legend-title">Legend</div>
              {LEGEND.map(item => (
                <div key={item.label} className="legend-item">
                  <div className="legend-dot" style={{ background: item.color }} />
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel: Node actions */}
        <NodePanel />

        {/* Overlay: Deep dive report */}
        {deepDiveContent && <DeepDivePanel />}
      </div>

      {/* Session History modal — rendered at app shell level so it overlays everything */}
      <SessionHistoryPanel />
    </div>
  );
}
