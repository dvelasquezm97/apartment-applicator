import Anthropic from '@anthropic-ai/sdk';
import type { InboxMessage, ClassificationResult, MessageIntent } from '../../types/message.js';
import { MESSAGE_INTENTS } from '../../types/message.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('inbox-monitor:classifier');

/** Rule-based keyword patterns (German + English) mapped to intents. */
const RULES: { intent: MessageIntent; patterns: RegExp[] }[] = [
  {
    intent: 'DOCUMENT_REQUEST',
    patterns: [
      /unterlagen/i, /dokument/i, /gehaltsnachwei/i, /schufa/i,
      /einkommensnachweis/i, /personalausweis/i, /mietschuldenfreiheit/i,
      /selbstauskunft/i, /bitte\s+senden/i, /bitte\s+schicken/i,
      /documents?\s+(?:required|needed)/i, /please\s+send/i, /proof\s+of/i,
    ],
  },
  {
    intent: 'VIEWING_INVITE',
    patterns: [
      /besichtigung/i, /besichtigungstermin/i, /termin/i,
      /einlad(?:en|ung)/i, /wir\s+laden\s+sie/i, /viewing/i,
      /(?:am|um)\s+\d{1,2}[.:]\d{2}/i, // Time patterns like "am 14:00" or "um 14.00"
      /appointment/i, /schedule\s+a\s+visit/i,
    ],
  },
  {
    intent: 'EXTERNAL_FORM',
    patterns: [
      /bewerbungsformular/i, /formular\s+aus/i, /online-bewerbung/i,
      /https?:\/\/(?:forms|docs|survey|typeform|jotform|wufoo)/i,
      /https?:\/\/[^\s]+(?:form|apply|bewerbung|antrag)/i,
      /fill\s+(?:out|in)\s+(?:the|our)\s+form/i,
    ],
  },
  {
    intent: 'REJECTION',
    patterns: [
      /leider\s+(?:müssen|können|haben)/i, /absage/i, /abgelehnt/i,
      /bereits\s+vergeben/i, /nicht\s+(?:mehr\s+)?verfügbar/i,
      /leider\s+nicht/i, /leider\s+eine/i, /(?:un)?fortunately/i, /rejected/i,
      /already\s+(?:taken|rented)/i,
    ],
  },
];

/** Minimum confidence threshold for rule-based classification */
const RULE_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Classify a message's intent using two-tier strategy:
 * 1. Rule-based pattern matching (fast, free)
 * 2. Claude Sonnet API fallback (for ambiguous messages)
 */
export async function classifyMessage(message: InboxMessage): Promise<ClassificationResult> {
  // Tier 1: Rule-based
  const ruleResult = classifyByRules(message.content);
  if (ruleResult.confidence >= RULE_CONFIDENCE_THRESHOLD) {
    log.debug({ intent: ruleResult.intent, confidence: ruleResult.confidence }, 'Classified by rules');
    return ruleResult;
  }

  // Tier 2: Claude API fallback
  try {
    const apiResult = await classifyWithClaude(message.content);
    log.debug({ intent: apiResult.intent, confidence: apiResult.confidence }, 'Classified by Claude API');
    return apiResult;
  } catch (err) {
    log.warn({ error: (err as Error).message }, 'Claude API classification failed — defaulting to GENERIC');
    return { intent: 'GENERIC', confidence: 0.3, reasoning: `API fallback failed: ${(err as Error).message}` };
  }
}

/**
 * Tier 1: Rule-based classification using keyword patterns.
 * Returns the best match with confidence based on pattern hit count.
 */
export function classifyByRules(content: string): ClassificationResult {
  let bestIntent: MessageIntent = 'GENERIC';
  let bestScore = 0;
  let bestPatterns: string[] = [];

  for (const rule of RULES) {
    const matches = rule.patterns.filter(p => p.test(content));
    if (matches.length > bestScore) {
      bestScore = matches.length;
      bestIntent = rule.intent;
      bestPatterns = matches.map(p => p.source);
    }
  }

  // Confidence: 1 match = 0.6, 2 matches = 0.8, 3+ matches = 0.95
  const confidence = bestScore === 0 ? 0.1 : Math.min(0.4 + bestScore * 0.2, 0.95);

  return {
    intent: bestIntent,
    confidence,
    reasoning: bestScore > 0
      ? `Rule-based: ${bestScore} pattern(s) matched [${bestPatterns.join(', ')}]`
      : 'No rule patterns matched',
  };
}

/**
 * Tier 2: Classify using Claude Sonnet with structured tool_use output.
 */
async function classifyWithClaude(content: string): Promise<ClassificationResult> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    tools: [
      {
        name: 'classify_message',
        description: 'Classify the intent of an apartment rental message from a landlord or property manager.',
        input_schema: {
          type: 'object' as const,
          properties: {
            intent: {
              type: 'string',
              enum: [...MESSAGE_INTENTS],
              description: 'The classified intent of the message.',
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Confidence score from 0 to 1.',
            },
            reasoning: {
              type: 'string',
              description: 'Brief explanation of why this intent was chosen.',
            },
          },
          required: ['intent', 'confidence', 'reasoning'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'classify_message' },
    messages: [
      {
        role: 'user',
        content: `Classify this apartment rental message from a German landlord/property manager.

Intent categories:
- DOCUMENT_REQUEST: Landlord asks for documents (income proof, SCHUFA, ID, etc.)
- VIEWING_INVITE: Landlord invites to a viewing/Besichtigung with date/time
- EXTERNAL_FORM: Landlord asks to fill out an external application form (includes URL)
- REJECTION: Landlord rejects the application (apartment taken, not selected, etc.)
- GENERIC: Any other message (thank you, general info, questions, etc.)

Message:
"""
${content}
"""`,
      },
    ],
  });

  // Extract tool_use result
  const toolBlock = response.content.find(b => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('No tool_use block in Claude response');
  }

  const input = toolBlock.input as { intent: string; confidence: number; reasoning: string };

  // Validate intent is a known value
  const validIntent = MESSAGE_INTENTS.includes(input.intent as MessageIntent)
    ? (input.intent as MessageIntent)
    : 'GENERIC';

  return {
    intent: validIntent,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    reasoning: `Claude API: ${input.reasoning}`,
  };
}
