import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { v4 as uuidv4 } from 'uuid';
import {
  getSession, updateSessionPhase, createNode, getSessionNodes
} from '@/lib/db';
import {
  runCreatorAgent, runSkepticAgent, runLateralAgent,
  checkRateLimit, isSafeContent
} from '@/lib/agents';
import { DBNode } from '@/types';

function send(controller: ReadableStreamDefaultController, data: object) {
  const encoded = new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
  try { controller.enqueue(encoded); } catch { /* stream closed */ }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;

  const session = getSession(sessionId);
  if (!session) {
    return new Response('Session not found', { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const existingNodes = getSessionNodes(sessionId);
        if (existingNodes.length > 1) {
          // Already has nodes — just send existing state
          send(controller, { type: 'existing_nodes', data: existingNodes });
          controller.close();
          return;
        }

        const rootNode = existingNodes.find(n => n.agent_type === 'root');
        if (!rootNode) {
          send(controller, { type: 'error', data: { message: 'Root node not found' } });
          controller.close();
          return;
        }

        // ── Phase 1: Creator ─────────────────────────────────────────────────
        updateSessionPhase(sessionId, 'generating');
        send(controller, { type: 'phase_changed', data: { phase: 'generating', message: 'Creator agent generating ideas...' } });

        if (!checkRateLimit(sessionId)) {
          send(controller, { type: 'error', data: { message: 'Rate limit reached. Please wait.' } });
          controller.close();
          return;
        }

        const creatorResult = await runCreatorAgent(session.original_prompt);
        const creatorNodes: DBNode[] = [];

        for (const idea of creatorResult.ideas.slice(0, 6)) {
          if (!isSafeContent(idea.title + ' ' + idea.description)) continue;

          const node = createNode({
            id: uuidv4(),
            session_id: sessionId,
            parent_id: rootNode.id,
            agent_type: 'creator',
            content: JSON.stringify({ title: idea.title, description: idea.description }),
            metadata: JSON.stringify({ tags: idea.tags, confidence_score: idea.potential_score ?? 70 }),
            grade: null,
            status: 'complete',
            x_pos: 0,
            y_pos: 0,
          });

          creatorNodes.push(node);
          send(controller, { type: 'node_created', data: node });
          await sleep(150); // stagger for visual effect
        }

        // ── Phase 2: Skeptic ─────────────────────────────────────────────────
        updateSessionPhase(sessionId, 'critiquing');
        send(controller, { type: 'phase_changed', data: { phase: 'critiquing', message: 'Skeptic agent analyzing ideas...' } });

        const skepticNodes: DBNode[] = [];

        for (const creatorNode of creatorNodes) {
          if (!checkRateLimit(sessionId)) break;

          const ideaData = parseContent(creatorNode.content);
          const critiqueResult = await runSkepticAgent(
            ideaData.description || ideaData.title || creatorNode.content,
            session.original_prompt
          );

          const mainConcern = critiqueResult.critiques[0];
          const node = createNode({
            id: uuidv4(),
            session_id: sessionId,
            parent_id: creatorNode.id,
            agent_type: 'skeptic',
            content: JSON.stringify({
              title: `⚠ ${mainConcern?.concern ?? 'Potential Risk'}`,
              description: critiqueResult.critiques.map(c => `[${c.severity.toUpperCase()}] ${c.concern}`).join('\n'),
            }),
            metadata: JSON.stringify({
              confidence_score: critiqueResult.confidence_score,
              critiques: critiqueResult.critiques,
            }),
            grade: null,
            status: 'complete',
            x_pos: 0,
            y_pos: 0,
          });

          skepticNodes.push(node);
          send(controller, { type: 'node_created', data: node });
          await sleep(200);
        }

        // ── Phase 3: Lateral Thinker ─────────────────────────────────────────
        updateSessionPhase(sessionId, 'evolving');
        send(controller, { type: 'phase_changed', data: { phase: 'evolving', message: 'Lateral Thinker evolving ideas...' } });

        for (let i = 0; i < Math.min(creatorNodes.length, 3); i++) {
          if (!checkRateLimit(sessionId)) break;

          const creatorNode = creatorNodes[i];
          const skepticNode = skepticNodes[i];
          if (!skepticNode) continue;

          const ideaData = parseContent(creatorNode.content);
          const critiqueData = parseContent(skepticNode.content);

          const lateralResult = await runLateralAgent(
            ideaData.description || ideaData.title || '',
            critiqueData.title?.replace('⚠ ', '') || '',
            session.original_prompt
          );

          for (const alt of lateralResult.alternatives) {
            if (!isSafeContent(alt.title + ' ' + alt.description)) continue;

            const node = createNode({
              id: uuidv4(),
              session_id: sessionId,
              parent_id: skepticNode.id,
              agent_type: 'lateral',
              content: JSON.stringify({ title: alt.title, description: alt.description }),
              metadata: JSON.stringify({ tags: [alt.inspiration], inspiration: alt.inspiration, confidence_score: alt.originality_score ?? 75 }),
              grade: null,
              status: 'complete',
              x_pos: 0,
              y_pos: 0,
            });

            send(controller, { type: 'node_created', data: node });
            await sleep(150);
          }
        }

        updateSessionPhase(sessionId, 'complete');
        send(controller, { type: 'phase_changed', data: { phase: 'complete', message: 'Brainstorming complete!' } });
        send(controller, { type: 'complete', data: {} });
      } catch (err) {
        console.error('[SSE stream error]', err);
        send(controller, { type: 'error', data: { message: String(err) } });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseContent(content: string): { title?: string; description?: string } {
  try { return JSON.parse(content); } catch { return { description: content }; }
}
