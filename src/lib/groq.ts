import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function chatCompletion(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    temperature: options.temperature ?? 0.8,
    max_tokens: options.maxTokens ?? 1024,
  });
  return response.choices[0]?.message?.content ?? '';
}

export async function* streamCompletion(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options: { temperature?: number; maxTokens?: number } = {}
): AsyncGenerator<string> {
  const stream = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    temperature: options.temperature ?? 0.8,
    max_tokens: options.maxTokens ?? 2048,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

export default groq;
