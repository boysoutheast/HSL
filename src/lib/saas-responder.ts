/**
 * SaaS Responder — DeepSeek LLM as state-machine driver.
 * One thread, many participants: worker, user, saas_llm, hermes.
 *
 * IDEMPOTENT: if saas_llm already responded for last message, skip.
 * DEEPSEEK ONLY — no other provider. Output MUST be valid JSON (retry 1x).
 * Secrets never logged.
 */

import { prisma } from '@/lib/prisma'
import { llmJson } from '@/lib/llm'
import { sendTelegram } from '@/lib/telegram'

const TELEGRAM_HERMES_CHAT_ID = process.env.TELEGRAM_HERMES_CHAT_ID ?? ''

interface SaasDecision {
  decision: 'NARRATE' | 'ASK_USER' | 'AUTO_CONTINUE' | 'ESCALATE'
  message: string
  nextTask?: { type: string; payload?: unknown }
}

const SYSTEM_PROMPT = `You are a SaaS operations assistant. Your job is to decide what happens next in a worker thread.

Input: thread history as JSON array of {role, kind, content} messages.
Output: JSON object with:
- decision: "NARRATE" | "ASK_USER" | "AUTO_CONTINUE" | "ESCALATE"
- message: your response text (Indonesian, casual, max 2 sentences)
- nextTask: (only for AUTO_CONTINUE) { type: string, payload?: object }

Rules:
- NARRATE: tell the user the final outcome, close thread.
- ASK_USER: need user input, ask a short question.
- AUTO_CONTINUE: run the next task immediately.
- ESCALATE: need Hermes (human) intervention.
- If the worker event is "completed" with no errors → NARRATE.
- If the worker event is "failed" → analyze severity. Simple retry → AUTO_CONTINUE. Need human → ESCALATE.
- If the worker event is "needs_input" → ASK_USER.
- Keep messages brief (2 sentences max).
- Respond in Indonesian.`

/**
 * Run SaaS responder for a thread. Idempotent — safe to call multiple times.
 * Returns the decision that was made.
 */
export async function runSaasResponder(threadId: string): Promise<SaasDecision | null> {
  // 1. Load thread
  const thread = await prisma.conversationThread.findUnique({
    where: { id: threadId },
    include: {
      messages: { orderBy: { createdAt: 'asc' }, take: 20 },
    },
  })

  if (!thread) {
    console.warn(`[saas-responder] Thread ${threadId} not found`)
    return null
  }

  // 2. Idempotency: skip if saas_llm already responded to the last message
  const lastMsg = thread.messages[thread.messages.length - 1]
  if (!lastMsg) {
    console.warn(`[saas-responder] Thread ${threadId} has no messages`)
    return null
  }

  // Find if there's already a saas_llm response AFTER the last non-saas_llm message
  const lastNonLlmIdx = [...thread.messages].reverse().findIndex(m => m.role !== 'saas_llm')
  if (lastNonLlmIdx > 0) {
    // Already responded — idempotent skip
    return null
  }

  // 3. Guard: cap auto_continue
  if (thread.autoContinueCount >= thread.maxAutoContinue) {
    // Force ASK_USER — cegah loop
    const forceMsg = 'Saya sudah mencoba beberapa kali tapi masih belum berhasil. Ada yang bisa saya bantu?'
    await prisma.threadMessage.create({
      data: {
        threadId,
        role: 'saas_llm',
        kind: 'decision',
        content: forceMsg,
        metadataJson: JSON.stringify({ forced: true, reason: 'auto_continue_cap' }),
      },
    })
    await prisma.conversationThread.update({
      where: { id: threadId },
      data: { status: 'waiting_user' },
    })
    if (thread.telegramChatId) {
      await sendTelegram(thread.telegramChatId, forceMsg)
    }
    return { decision: 'ASK_USER', message: forceMsg }
  }

  // 4. Call DeepSeek
  const contextMessages = thread.messages.map(m => ({
    role: m.role,
    kind: m.kind,
    content: m.content.slice(0, 500),
  }))

  let decision: SaasDecision
  try {
    decision = await callDeepSeekWithRetry(contextMessages)
  } catch (err) {
    console.error('[saas-responder] DeepSeek failed, fallback ASK_USER:', (err as Error).message)
    // Fallback: ASK_USER
    const fallbackMsg = 'Maaf, sistem sedang sibuk. Ada yang bisa saya bantu?'
    await prisma.threadMessage.create({
      data: {
        threadId,
        role: 'saas_llm',
        kind: 'decision',
        content: fallbackMsg,
        metadataJson: JSON.stringify({ fallback: true, reason: 'deepseek_error' }),
      },
    })
    await prisma.conversationThread.update({
      where: { id: threadId },
      data: { status: 'waiting_user' },
    })
    if (thread.telegramChatId) {
      await sendTelegram(thread.telegramChatId, fallbackMsg)
    }
    return { decision: 'ASK_USER', message: fallbackMsg }
  }

  // 5. Insert saas_llm message
  await prisma.threadMessage.create({
    data: {
      threadId,
      role: 'saas_llm',
      kind: 'decision',
      content: decision.message,
      metadataJson: JSON.stringify({ decision: decision.decision, nextTask: decision.nextTask ?? null }),
    },
  })

  // 6. Side effects by decision
  switch (decision.decision) {
    case 'NARRATE':
      await prisma.conversationThread.update({
        where: { id: threadId },
        data: { status: 'closed' },
      })
      break

    case 'ASK_USER':
      await prisma.conversationThread.update({
        where: { id: threadId },
        data: { status: 'waiting_user' },
      })
      break

    case 'AUTO_CONTINUE': {
      await prisma.conversationThread.update({
        where: { id: threadId },
        data: { autoContinueCount: { increment: 1 } },
      })
      // Create worker task for next step
      if (decision.nextTask?.type) {
        await prisma.workerTask.create({
          data: {
            type: decision.nextTask.type,
            capability: 'content_generation',
            priority: 5,
            maxAttempts: 2,
            scope: 'internal',
            status: 'pending',
            payloadJson: JSON.stringify(decision.nextTask.payload ?? {}),
          },
        })
      }
      break
    }

    case 'ESCALATE': {
      await prisma.conversationThread.update({
        where: { id: threadId },
        data: { status: 'waiting_user' },
      })
      // Insert hermes placeholder
      await prisma.threadMessage.create({
        data: {
          threadId,
          role: 'hermes',
          kind: 'text',
          content: `[ESCALATE] ${decision.message}`,
          metadataJson: JSON.stringify({ escalated: true }),
        },
      })
      // Notif Hermes via Telegram
      if (TELEGRAM_HERMES_CHAT_ID) {
        await sendTelegram(
          TELEGRAM_HERMES_CHAT_ID,
          `🚨 *ESCALATE*\nThread: \`${threadId}\`\nSubject: ${thread.subjectType}/${thread.subjectId}\nPesan: ${decision.message}`,
        )
      }
      break
    }
  }

  // 7. Kirim message ke user via Telegram (kalau ada chatId)
  if (thread.telegramChatId && decision.decision !== 'ESCALATE') {
    await sendTelegram(thread.telegramChatId, decision.message)
  }

  return decision
}

async function callDeepSeekWithRetry(context: unknown[]): Promise<SaasDecision> {
  const userMsg = JSON.stringify(context)
  const systemMsg = SYSTEM_PROMPT

  let lastErr: Error | undefined

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await llmJson<SaasDecision>(systemMsg, userMsg, 1024)
      // Validate
      const validDecisions = ['NARRATE', 'ASK_USER', 'AUTO_CONTINUE', 'ESCALATE']
      if (!validDecisions.includes(result.decision)) {
        throw new Error(`Invalid decision: ${result.decision}`)
      }
      if (!result.message?.trim()) {
        throw new Error('Empty message in decision')
      }
      return result
    } catch (err) {
      lastErr = err as Error
      if (attempt === 0) {
        // Retry once
        console.warn(`[saas-responder] DeepSeek attempt ${attempt + 1} failed, retrying...`)
      }
    }
  }

  throw new Error(`DeepSeek failed after 2 attempts: ${lastErr?.message}`)
}
