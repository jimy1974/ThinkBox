import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { createSession, createNode, getSession, getSessionNodes, getAllSessions, deleteSession } from '@/lib/db';
import { isSafeContent } from '@/lib/agents';

// Helper: get userId from NextAuth session, fall back to 'anonymous'
async function getUserId(): Promise<string> {
  try {
    const session = await getServerSession(authOptions);
    return (session?.user as { id?: string })?.id ?? 'anonymous';
  } catch {
    return 'anonymous';
  }
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const trimmed = prompt.trim();
    if (trimmed.length < 10 || trimmed.length > 2000) {
      return NextResponse.json({ error: 'Prompt must be 10-2000 characters' }, { status: 400 });
    }

    if (!isSafeContent(trimmed)) {
      return NextResponse.json({ error: 'Prompt contains disallowed content' }, { status: 400 });
    }

    const userId = await getUserId();
    const sessionId = uuidv4();
    const session = createSession(sessionId, trimmed, userId);

    // Create root node
    const rootNode = createNode({
      id: uuidv4(),
      session_id: sessionId,
      parent_id: null,
      agent_type: 'root',
      content: trimmed,
      metadata: '{}',
      grade: null,
      status: 'complete',
      x_pos: 0,
      y_pos: 0,
    });

    return NextResponse.json({ session, rootNode }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/sessions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  // GET /api/sessions?id=... => single session + nodes
  if (id) {
    const session = getSession(id);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const nodes = getSessionNodes(id);
    return NextResponse.json({ session, nodes });
  }

  // GET /api/sessions => list all sessions for this user
  const userId = await getUserId();
  const sessions = getAllSessions(userId);
  return NextResponse.json({ sessions });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    deleteSession(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/sessions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
