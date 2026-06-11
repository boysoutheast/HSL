// LLM helper terpusat — SEMUA fitur AI di app pakai ini.
// Provider: DeepSeek (OpenAI-compatible chat completions API).
// Env: DEEPSEEK_API_KEY (wajib), DEEPSEEK_MODEL, DEEPSEEK_BASE_URL (opsional).

const BASE_URL = (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '')
const MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'

export class LlmError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

export function llmConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY)
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

async function chat(
  messages: ChatMessage[],
  opts?: { jsonMode?: boolean; maxTokens?: number; temperature?: number }
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new LlmError('LLM belum dikonfigurasi. Set DEEPSEEK_API_KEY di Railway.', 503)
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: opts?.maxTokens ?? 4096,
      ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  const data = (await res.json().catch(() => ({}))) as ChatCompletionResponse
  if (!res.ok) {
    throw new LlmError(data.error?.message ?? `LLM request failed (HTTP ${res.status})`, res.status)
  }

  const content = data.choices?.[0]?.message?.content
  if (!content) throw new LlmError('LLM returned empty response')
  return content
}

/** Kirim prompt, dapat plain text. */
export async function llmText(system: string, user: string, maxTokens?: number): Promise<string> {
  return chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens }
  )
}

/** Kirim prompt, dapat JSON object yang sudah di-parse. */
export async function llmJson<T = unknown>(system: string, user: string, maxTokens?: number): Promise<T> {
  const raw = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { jsonMode: true, maxTokens, temperature: 0 }
  )

  // Defensive: strip markdown fences kalau model membungkus output
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned) as T
  } catch {
    throw new LlmError(`LLM output bukan JSON valid: ${cleaned.slice(0, 200)}`)
  }
}
