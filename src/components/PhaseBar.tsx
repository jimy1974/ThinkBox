'use client';
import { useStore } from '@/store/useStore';

const PHASES = [
  { key: 'generating', label: 'Creator', icon: '💡', color: '#10b981' },
  { key: 'critiquing', label: 'Skeptic', icon: '⚠️', color: '#f59e0b' },
  { key: 'evolving', label: 'Lateral', icon: '🔀', color: '#8b5cf6' },
  { key: 'complete', label: 'Done', icon: '✅', color: '#3b82f6' },
];

const PHASE_ORDER = ['idle', 'generating', 'critiquing', 'evolving', 'complete'];

export default function PhaseBar() {
  const { phase, isStreaming } = useStore();

  if (phase === 'idle') return null;

  const currentIdx = PHASE_ORDER.indexOf(phase);

  return (
    <div className="phase-bar">
      {PHASES.map((p, i) => {
        const phaseIdx = PHASE_ORDER.indexOf(p.key);
        const isDone = phaseIdx < currentIdx;
        const isActive = p.key === phase;

        return (
          <div key={p.key} className={`phase-step ${isDone ? 'phase-done' : ''} ${isActive ? 'phase-active' : ''}`}>
            <div
              className="phase-dot"
              style={{
                background: isDone || isActive ? p.color : '#334155',
                boxShadow: isActive ? `0 0 12px ${p.color}` : 'none',
              }}
            >
              {isDone ? '✓' : p.icon}
            </div>
            <span className="phase-label" style={{ color: isDone || isActive ? p.color : '#475569' }}>
              {p.label}
            </span>
            {i < PHASES.length - 1 && (
              <div className="phase-connector" style={{ background: isDone ? p.color : '#334155' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
