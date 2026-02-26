import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import {
  getNode, updateNode, createNode, createDeepDive, getDeepDive, getSession,
  countChildNodes, getSessionNodes
} from '@/lib/db';
import {
  runExpansionAgent, runDeepDiveAgent, isSafeContent, checkRateLimit
} from '@/lib/agents';

// PATCH /api/nodes/:id — update grade or position
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const node = getNode(id);
  if (!node) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const allowed = ['grade', 'status', 'x_pos', 'y_pos'] as const;
  const updates: Partial<Pick<typeof node, 'grade' | 'status' | 'x_pos' | 'y_pos'>> = {};

  for (const key of allowed) {
    if (key in body) {
      // @ts-expect-error dynamic key
      updates[key] = body[key];
    }
  }

  if ('grade' in updates) {
    const g = updates.grade;
    if (g !== null && (typeof g !== 'number' || g < 1 || g > 5)) {
      return NextResponse.json({ error: 'grade must be 1–5' }, { status: 400 });
    }
  }

  updateNode(id, updates);
  return NextResponse.json({ success: true });
}

// POST /api/nodes/:id/expand — expand a node with sub-ideas
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action } = await req.json();

    const node = getNode(id);
    if (!node) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const session = getSession(node.session_id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Rate limit per session
    if (!checkRateLimit(node.session_id)) {
      return NextResponse.json({ error: 'Rate limit reached. Please wait a moment.' }, { status: 429 });
    }

    // Cap total nodes per session
    const allNodes = getSessionNodes(node.session_id);
    if (allNodes.length >= 50) {
      return NextResponse.json({ error: 'Maximum node limit (50) reached for this session.' }, { status: 429 });
    }

    const nodeData = parseContent(node.content);

    if (action === 'expand') {
      const childCount = countChildNodes(id);
      if (childCount >= 4) {
        return NextResponse.json({ error: 'Node already has maximum children (4).' }, { status: 400 });
      }

      const result = await runExpansionAgent(
        nodeData.description || nodeData.title || node.content,
        node.agent_type,
        session.original_prompt
      );

      const newNodes = [];
      for (const exp of result.expansions.slice(0, 3)) {
        if (!isSafeContent(exp.title + ' ' + exp.description)) continue;

        const childType = node.agent_type === 'skeptic' ? 'skeptic'
          : node.agent_type === 'lateral' ? 'lateral'
          : 'creator';

        const created = createNode({
          id: uuidv4(),
          session_id: node.session_id,
          parent_id: id,
          agent_type: childType,
          content: JSON.stringify({ title: exp.title, description: exp.description }),
          metadata: '{}',
          grade: null,
          status: 'complete',
          x_pos: 0,
          y_pos: 0,
        });
        newNodes.push(created);
      }

      return NextResponse.json({ nodes: newNodes });
    }

    if (action === 'deep_dive') {
      // Check if already exists
      const existing = getDeepDive(id);
      if (existing) return NextResponse.json({ deepDive: existing });

      const title = nodeData.title || 'Idea';
      const description = nodeData.description || node.content;

      const markdown = await runDeepDiveAgent(description, title, session.original_prompt);

      const deepDive = createDeepDive(uuidv4(), id, markdown);
      return NextResponse.json({ deepDive });
    }

    if (action === 'ignore') {
      updateNode(id, { status: 'ignored' });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (err: unknown) {
    console.error('[POST /api/nodes] Error:', err);

    // Detect Groq auth / permission errors
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('403') || message.includes('401') || message.includes('Access denied') || message.includes('PermissionDenied')) {
      return NextResponse.json(
        { error: 'AI service authentication failed. Please check your GROQ_API_KEY in .env.local and restart the server.' },
        { status: 503 }
      );
    }

    // Rate limit from Groq
    if (message.includes('429') || message.includes('rate limit') || message.includes('RateLimit')) {
      return NextResponse.json(
        { error: 'AI service rate limit reached. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: 'Internal server error. Please try again.' }, { status: 500 });
  }
}

function parseContent(content: string): { title?: string; description?: string } {
  try { return JSON.parse(content); } catch { return { description: content }; }
}
