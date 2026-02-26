'use client';
import { useState, FormEvent } from 'react';
import { useStore } from '@/store/useStore';
import { DBNode } from '@/types';

const EXAMPLE_PROMPTS = [
  'How to desalinate water cheaply for developing nations',
  'New ways to reduce urban traffic congestion',
  'Innovative approaches to treat antibiotic-resistant bacteria',
  'How to make remote work more engaging and productive',
];

export default function ProblemForm() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { initSession, reset, toggleHistory } = useStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      reset();
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start session');

      initSession(data.session.id, trimmed, data.rootNode as DBNode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="problem-form-wrap">
      <div className="problem-form-inner">
        <div className="form-logo">
          <span className="logo-icon">🧠</span>
          <div>
            <h1 className="logo-title">ThinkBox</h1>
            <p className="logo-subtitle">Multi-Agent AI Brainstorming</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="problem-form">
          <label className="form-label" htmlFor="problem-input">
            What problem do you want to explore?
          </label>
          <textarea
            id="problem-input"
            className="problem-textarea"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g. How to desalinate water cheaply for developing nations..."
            rows={3}
            maxLength={2000}
            disabled={loading}
          />
          <div className="form-meta">
            <span className="char-count">{prompt.length}/2000</span>
          </div>

          {error && <div className="form-error">&#9888; {error}</div>}

          <button
            type="submit"
            className="submit-btn"
            disabled={loading || prompt.trim().length < 10}
          >
            {loading ? (
              <><span className="spinner" /> Starting brainstorm...</>
            ) : (
              '🚀 Start Brainstorming'
            )}
          </button>
        </form>

        <div className="examples-section">
          <p className="examples-label">Try an example:</p>
          <div className="examples-grid">
            {EXAMPLE_PROMPTS.map(ex => (
              <button
                key={ex}
                className="example-btn"
                onClick={() => setPrompt(ex)}
                disabled={loading}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* History link */}
        <div className="form-history-link">
          <button
            type="button"
            className="history-link-btn"
            onClick={toggleHistory}
            disabled={loading}
          >
            📚 Browse previous sessions
          </button>
        </div>
      </div>
    </div>
  );
}
