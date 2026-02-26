'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useStore } from '@/store/useStore';
import { DBNode } from '@/types';

interface SessionSummary {
  id: string;
  original_prompt: string;
  phase: string;
  created_at: string;
  node_count: number;
  user_id: string;
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr + (isoStr.endsWith('Z') ? '' : 'Z'));
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SessionHistoryPanel() {
  const { showHistory, setShowHistory, initSession, reset, addChildNodes, setPhase, triggerFitView } = useStore();
  const { data: authSession, status } = useSession();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load sessions');
      setSessions(data.sessions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showHistory) fetchSessions();
  }, [showHistory, fetchSessions, status]);

  const handleOpen = async (sessionId: string) => {
    setOpeningId(sessionId);
    setError(null);
    try {
      const res = await fetch(`/api/sessions?id=${sessionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load session');

      const rootNode = data.nodes.find((n: DBNode) => n.agent_type === 'root');
      if (!rootNode) throw new Error('Session root node not found');

      // Load nodes directly — do NOT rely on SSE for restoration, because
      // React 18 batches reset()+initSession() and the sessionId might not
      // appear to change, so the SSE useEffect would never fire.
      const otherNodes = (data.nodes as DBNode[]).filter(n => n.agent_type !== 'root');

      reset();
      initSession(data.session.id, data.session.original_prompt, rootNode);

      if (otherNodes.length > 0) {
        addChildNodes(otherNodes);
      }

      setPhase('complete', 'Session restored');
      triggerFitView();
      // showHistory is set to false inside initSession already
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this session and all its nodes? This cannot be undone.')) return;

    setDeletingId(sessionId);
    try {
      const res = await fetch(`/api/sessions?id=${sessionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete session');
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  };

  if (!showHistory) return null;

  const isGoogleConfigured = true; // always show Google option

  return (
    <div className="history-overlay" onClick={() => setShowHistory(false)}>
      <div className="history-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="history-header">
          <div className="history-header-left">
            <span className="history-title-icon">📚</span>
            <div>
              <h2 className="history-title">Session History</h2>
              <p className="history-subtitle">
                {authSession?.user
                  ? `Signed in as ${authSession.user.name ?? authSession.user.email}`
                  : 'Browsing as guest — sign in to sync across devices'}
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={() => setShowHistory(false)} title="Close">✕</button>
        </div>

        {/* Auth row */}
        <div className="history-auth-row">
          {authSession?.user ? (
            <div className="auth-user-row">
              {authSession.user.image && (
                <img
                  src={authSession.user.image}
                  alt="avatar"
                  className="auth-avatar"
                />
              )}
              <span className="auth-user-name">{authSession.user.name ?? authSession.user.email}</span>
              <button
                className="auth-signout-btn"
                onClick={() => signOut({ redirect: false })}
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="auth-signin-row">
              <span className="auth-signin-hint">Sign in to save sessions to your account:</span>
              <button
                className="google-signin-btn"
                onClick={() => signIn('google', { redirect: false })}
              >
                <GoogleIcon />
                Sign in with Google
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && <div className="history-error">⚠ {error}</div>}

        {/* Sessions list */}
        <div className="history-list">
          {loading ? (
            <div className="history-empty">
              <span className="spinner" />
              <span>Loading sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="history-empty">
              <span className="history-empty-icon">🧠</span>
              <p>No saved sessions yet.</p>
              <p className="history-empty-sub">Start a new brainstorm to create your first session!</p>
            </div>
          ) : (
            sessions.map(session => (
              <div key={session.id} className="history-item">
                <div className="history-item-content" onClick={() => handleOpen(session.id)}>
                  <div className="history-item-prompt">
                    {session.original_prompt.length > 90
                      ? session.original_prompt.substring(0, 87) + '...'
                      : session.original_prompt}
                  </div>
                  <div className="history-item-meta">
                    <span className="history-meta-date">🕐 {formatDate(session.created_at)}</span>
                    <span className="history-meta-nodes">💡 {session.node_count} ideas</span>
                    <span
                      className={`history-meta-phase ${session.phase === 'complete' ? 'phase-done' : 'phase-partial'}`}
                    >
                      {session.phase === 'complete' ? '✅ Complete' : '⏳ Partial'}
                    </span>
                  </div>
                </div>
                <div className="history-item-actions">
                  <button
                    className="history-open-btn"
                    onClick={() => handleOpen(session.id)}
                    disabled={openingId === session.id}
                    title="Open this session"
                  >
                    {openingId === session.id ? <span className="spinner" /> : 'Open →'}
                  </button>
                  <button
                    className="history-delete-btn"
                    onClick={e => handleDelete(session.id, e)}
                    disabled={deletingId === session.id}
                    title="Delete this session"
                  >
                    {deletingId === session.id ? '...' : '🗑'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="history-footer">
          <span className="history-footer-note">
            {sessions.length > 0 && `${sessions.length} session${sessions.length !== 1 ? 's' : ''} stored locally`}
          </span>
          <button className="history-refresh-btn" onClick={fetchSessions} disabled={loading}>
            {loading ? '...' : '↻ Refresh'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
