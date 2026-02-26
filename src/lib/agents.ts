import { chatCompletion } from './groq';
import { AgentType, NodeMetadata } from '@/types';

const RATE_LIMIT_MAP = new Map<string, number[]>();
export const MAX_NODES_PER_SESSION = 50;
const MAX_NODES_PER_MINUTE = 15;

export function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const window = 60_000;
  const timestamps = RATE_LIMIT_MAP.get(sessionId) ?? [];
  const recent = timestamps.filter(t => now - t < window);
  if (recent.length >= MAX_NODES_PER_MINUTE) return false;
  recent.push(now);
  RATE_LIMIT_MAP.set(sessionId, recent);
  return true;
}

// Content safety filter
const BLOCKED_PATTERNS = [
  /\b(bomb|explosive|weapon|kill|murder|hack|malware|ransomware|suicide|self.harm)\b/i,
];

export function isSafeContent(text: string): boolean {
  return !BLOCKED_PATTERNS.some(p => p.test(text));
}

export function sanitizeWebContent(text: string): string {
  // Strip potential injection patterns from web-sourced content
  return text
    .replace(/<[^>]*>/g, '') // strip HTML
    .replace(/\[INST\].*?\[\/INST\]/gs, '') // strip instruction tags
    .replace(/system:/gi, '') // strip system prompts
    .substring(0, 2000); // hard limit
}

// Creator Agent

export interface IdeaResult {
  ideas: Array<{ title: string; description: string; tags: string[]; potential_score: number }>;
}

export async function runCreatorAgent(prompt: string): Promise<IdeaResult> {
  const systemPrompt = `You are the Creator Agent in a brainstorming system. Your role is to generate diverse, creative, and actionable ideas.

Rules:
- Generate exactly 6 distinct ideas
- Each idea must be practical and grounded
- Cover different approaches (technology, social, economic, biological, etc.)
- Return ONLY valid JSON, no markdown
- Keep descriptions concise (2-3 sentences)
- Assign a potential_score (0-100) reflecting how promising and feasible each idea is - vary scores meaningfully based on each idea's strengths`;

  const userPrompt = `Generate 6 creative ideas for this problem: "${prompt}"

Return JSON in this exact format:
{
  "ideas": [
    {
      "title": "Short descriptive title",
      "description": "2-3 sentence description of the approach",
      "tags": ["tag1", "tag2"],
      "potential_score": <integer 0-100, your honest assessment for this specific idea>
    }
  ]
}`;

  const raw = await chatCompletion(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { temperature: 0.9, maxTokens: 1500 }
  );

  try {
    const json = extractJSON(raw);
    return JSON.parse(json) as IdeaResult;
  } catch {
    // Fallback: parse manually
    return { ideas: [{ title: 'Creative Approach', description: raw.substring(0, 200), tags: ['general'], potential_score: 70 }] };
  }
}

// Skeptic Agent

export interface CritiqueResult {
  critiques: Array<{
    concern: string;
    severity: 'low' | 'medium' | 'high';
    counterpoint?: string;
  }>;
  confidence_score: number;
}

export async function runSkepticAgent(idea: string, parentTitle: string): Promise<CritiqueResult> {
  const systemPrompt = `You are the Skeptic Agent in a brainstorming system. Your role is to critically analyze ideas, identify weaknesses, and provide reality checks.

Rules:
- Identify 2-3 concrete concerns or risks
- Be constructive, not purely negative
- Consider technical feasibility, cost, social impact, and scalability
- Assign severity: low/medium/high
- Provide a confidence score 0-100 for the idea's viability
- Return ONLY valid JSON, no markdown`;

  const userPrompt = `Critically analyze this idea for: "${parentTitle}"

Idea: "${idea}"

Return JSON:
{
  "critiques": [
    {
      "concern": "Specific concern or risk",
      "severity": "low|medium|high",
      "counterpoint": "Optional: how this might be addressed"
    }
  ],
  "confidence_score": <integer 0-100 based on your analysis of viability>
}`;

  const raw = await chatCompletion(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { temperature: 0.6, maxTokens: 800 }
  );

  try {
    return JSON.parse(extractJSON(raw)) as CritiqueResult;
  } catch {
    return {
      critiques: [{ concern: 'Requires further validation', severity: 'medium' }],
      confidence_score: 50,
    };
  }
}

// Lateral Thinker Agent

export interface LateralResult {
  alternatives: Array<{
    title: string;
    description: string;
    inspiration: string;
    originality_score: number;
  }>;
}

export async function runLateralAgent(
  originalIdea: string,
  critique: string,
  originalPrompt: string
): Promise<LateralResult> {
  const systemPrompt = `You are the Lateral Thinker Agent in a brainstorming system. You see the critique of an idea and reimagine it from completely different angles.

Rules:
- Generate 2 alternative approaches inspired by the critique
- Think cross-domain: borrow from biology, art, gaming, nature, ancient history, etc.
- Each alternative should directly address the critique's concerns
- Return ONLY valid JSON, no markdown`;

  const userPrompt = `Original problem: "${originalPrompt}"
Original idea: "${originalIdea}"
Critique concern: "${critique}"

Generate 2 lateral alternatives that address the critique:
{
  "alternatives": [
    {
      "title": "Alternative title",
      "description": "How this lateral approach works",
      "inspiration": "What field/concept this borrows from",
      "originality_score": <integer 0-100, how novel and creative this approach is>
    }
  ]
}`;

  const raw = await chatCompletion(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { temperature: 0.95, maxTokens: 800 }
  );

  try {
    return JSON.parse(extractJSON(raw)) as LateralResult;
  } catch {
    return {
      alternatives: [{ title: 'Alternative Approach', description: raw.substring(0, 200), inspiration: 'Cross-domain thinking', originality_score: 75 }],
    };
  }
}

// Expansion Agent

export interface ExpansionResult {
  expansions: Array<{ title: string; description: string }>;
}

export async function runExpansionAgent(
  nodeContent: string,
  agentType: AgentType,
  originalPrompt: string
): Promise<ExpansionResult> {
  const persona = agentType === 'skeptic'
    ? 'critical analyst identifying deeper risks'
    : agentType === 'lateral'
    ? 'creative thinker exploring unexpected angles'
    : 'innovative problem-solver detailing implementation';

  const userPrompt = `As a ${persona}, expand on this idea in depth for: "${originalPrompt}"

Idea: "${nodeContent}"

Generate 3 more specific sub-ideas or implementation steps. Return JSON:
{
  "expansions": [
    { "title": "Sub-idea title", "description": "2-3 sentences" }
  ]
}`;

  const raw = await chatCompletion(
    [{ role: 'user', content: userPrompt }],
    { temperature: 0.85, maxTokens: 900 }
  );

  try {
    return JSON.parse(extractJSON(raw)) as ExpansionResult;
  } catch {
    return { expansions: [{ title: 'Deep Dive', description: raw.substring(0, 200) }] };
  }
}

// Deep Dive Report Agent

export async function runDeepDiveAgent(
  nodeContent: string,
  nodeTitle: string,
  originalPrompt: string
): Promise<string> {
  const systemPrompt = `You are a research analyst writing a detailed strategic report. Write in markdown format.`;

  const userPrompt = `Write a comprehensive deep-dive report on this idea.

Original Problem: "${originalPrompt}"
Idea to Analyze: "${nodeTitle}"
Details: "${nodeContent}"

Write a ~600 word report covering:
# ${nodeTitle}: Deep Dive Analysis

## Executive Summary
## How It Works (Technical/Practical Details)
## Key Advantages
## Challenges & Risks
## Implementation Roadmap (3 phases)
## Success Metrics
## Conclusion

Use markdown headers, bullet points, and bold text appropriately.`;

  const raw = await chatCompletion(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { temperature: 0.7, maxTokens: 2000 }
  );

  return raw;
}

// Utility

function extractJSON(text: string): string {
  // Try to extract JSON from markdown code blocks or raw text
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    return text.substring(firstBrace, lastBrace + 1);
  }
  return text.trim();
}
