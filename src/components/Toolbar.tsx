'use client';
import { useStore } from '@/store/useStore';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useCallback } from 'react';

const PHASE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  idle: { label: 'Ready', color: '#64748b', icon: '⏸' },
  generating: { label: 'Creator generating ideas...', color: '#10b981', icon: '💡' },
  critiquing: { label: 'Skeptic analyzing...', color: '#f59e0b', icon: '⚠️' },
  evolving: { label: 'Lateral Thinker evolving...', color: '#8b5cf6', icon: '🔀' },
  complete: { label: 'Complete', color: '#3b82f6', icon: '✅' },
};

export default function Toolbar() {
  const {
    phase, phaseMessage, isStreaming, sessionId, originalPrompt,
    nodes, reLayout, triggerFitView, reset, toggleHistory,
  } = useStore();

  const { data: authSession } = useSession();

  const phaseInfo = PHASE_LABELS[phase] ?? PHASE_LABELS.idle;
  const ideaCount = nodes.filter(n => n.data.agentType === 'creator').length;
  const critiqueCount = nodes.filter(n => n.data.agentType === 'skeptic').length;
  const lateralCount = nodes.filter(n => n.data.agentType === 'lateral').length;

  const handleExportTree = useCallback(async () => {
    if (!sessionId) return;

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

    const margin = 15;
    let y = margin;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - margin * 2;

    doc.setFontSize(20);
    doc.setTextColor(30, 58, 138);
    doc.text('ThinkBox - Brainstorm Tree Export', margin, y);
    y += 10;

    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text(`Problem: ${originalPrompt}`, margin, y, { maxWidth });
    y += 10;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    const agentLabel: Record<string, string> = {
      root: 'Root', creator: 'Idea', skeptic: 'Critique',
      lateral: 'Alternative', summary: 'Summary',
    };

    const sortedNodes = [...nodes].sort((a, b) => {
      const order = { root: 0, creator: 1, skeptic: 2, lateral: 3, summary: 4 };
      return (order[a.data.agentType] ?? 5) - (order[b.data.agentType] ?? 5);
    });

    for (const node of sortedNodes) {
      const d = node.data;
      if (d.agentType === 'root') continue;
      if (d.status === 'ignored') continue;

      const contentParsed: { title?: string; description?: string } = (() => {
        try { return JSON.parse(d.content); } catch { return { description: d.content }; }
      })();

      const header = `${agentLabel[d.agentType] ?? d.agentType}${d.grade ? ` [*${d.grade}]` : ''}`;
      const title = contentParsed.title ?? '';
      const desc = contentParsed.description ?? '';

      const entryHeight = 22;
      if (y + entryHeight > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }

      const colors: Record<string, [number, number, number]> = {
        creator: [16, 185, 129], skeptic: [245, 158, 11],
        lateral: [139, 92, 246], summary: [59, 130, 246],
      };
      const [r, g, b] = colors[d.agentType] ?? [100, 100, 100];
      doc.setFillColor(r, g, b);
      doc.roundedRect(margin, y - 5, 6, 6, 1, 1, 'F');

      doc.setFontSize(9);
      doc.setTextColor(r, g, b);
      doc.text(header, margin + 10, y);

      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      if (title) doc.text(title, margin + 10, y + 5, { maxWidth: maxWidth - 10 });

      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      if (desc) {
        const descLines = doc.splitTextToSize(desc.substring(0, 200), maxWidth - 10);
        doc.text(descLines, margin + 10, y + 11);
      }

      y += entryHeight + 4;
    }

    doc.save(`thinkbox-tree-${sessionId?.substring(0, 8)}.pdf`);
  }, [sessionId, originalPrompt, nodes]);

  // Always render toolbar (History/Auth always accessible)
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button
          className="toolbar-logo-btn"
          onClick={sessionId ? reset : undefined}
          title={sessionId ? 'New brainstorm' : 'ThinkBox'}
          style={{ cursor: sessionId ? 'pointer' : 'default' }}
        >
          🧠 ThinkBox
        </button>

        {sessionId && (
          <>
            <span className="toolbar-sep">|</span>
            <div className="phase-indicator" style={{ color: phaseInfo.color }}>
              {isStreaming && <span className="pulse-dot" style={{ background: phaseInfo.color }} />}
              <span>{phaseInfo.icon}</span>
              <span>{phaseMessage || phaseInfo.label}</span>
            </div>
          </>
        )}
      </div>

      {sessionId && (
        <div className="toolbar-stats">
          <span className="stat-chip stat-creator">💡 {ideaCount}</span>
          <span className="stat-chip stat-skeptic">⚠️ {critiqueCount}</span>
          <span className="stat-chip stat-lateral">🔀 {lateralCount}</span>
          <span className="stat-total">{nodes.length} nodes</span>
        </div>
      )}

      <div className="toolbar-right">
        {/* History button — always visible */}
        <button
          className="toolbar-btn toolbar-btn-history"
          onClick={toggleHistory}
          title="Browse saved sessions"
        >
          📚 History
        </button>

        {sessionId && (
          <>
            <button
              className="toolbar-btn"
              onClick={() => { reLayout(); triggerFitView(); }}
              title="Re-layout tree and fit view"
            >
              📐 Layout
            </button>
            <button
              className="toolbar-btn toolbar-btn-export"
              onClick={handleExportTree}
              title="Export full tree to PDF"
            >
              📄 Export Tree
            </button>
            <button
              className="toolbar-btn toolbar-btn-new"
              onClick={reset}
              title="Start new session"
            >
              ✚ New
            </button>
          </>
        )}

        {/* Google auth button */}
        {authSession?.user ? (
          <div className="toolbar-user">
            {authSession.user.image && (
              <img
                src={authSession.user.image}
                alt="avatar"
                className="toolbar-avatar"
                title={authSession.user.name ?? undefined}
              />
            )}
            <button
              className="toolbar-btn toolbar-btn-signout"
              onClick={() => signOut({ redirect: false })}
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            className="toolbar-btn toolbar-btn-signin"
            onClick={() => signIn('google', { redirect: false })}
            title="Sign in with Google to save sessions across devices"
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}
