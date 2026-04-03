import { Agent } from '@mastra/core/agent'
import { z } from 'zod'

import { webSearchTool } from '../tools/web-search-tool.js'

/* ── Structured output schema ──────────────────────────────────────────────── */

export const baResponseSchema = z.object({
  message: z
    .string()
    .describe('Conversational reply shown as a chat bubble. Always friendly and concise.'),

  phase: z
    .enum(['discovery', 'research', 'refinement', 'validation', 'complete'])
    .describe('Current BMAD phase of the conversation.'),

  questions: z
    .array(
      z.object({
        id: z.string().describe('Unique slug for this question, e.g. "target_user"'),
        question: z.string().describe('The question to ask the user'),
        options: z
          .array(z.string())
          .describe('3–5 suggested answers to display as selectable chips'),
        allowCustom: z
          .boolean()
          .describe('Whether the user can type a free-form custom answer'),
        multiSelect: z
          .boolean()
          .describe('Whether the user can select multiple options'),
      }),
    )
    .describe(
      'Clarifying questions shown in the panel above the chat input. Empty array when no questions are needed (e.g. normal conversation or final brief).',
    ),

  brief: z
    .string()
    .optional()
    .describe(
      'Markdown-formatted product brief. Only populated when phase is "complete".',
    ),
})

export type BAResponse = z.infer<typeof baResponseSchema>

/* ── Agent ─────────────────────────────────────────────────────────────────── */

export const baAgent = new Agent({
  id: 'ba-agent',
  name: 'BA Brainstorm',
  description:
    'Business Analyst agent that helps users refine product ideas using the BMAD method, backed by live web research.',

  model: 'anthropic/claude-haiku-4-5',

  instructions: `
You are an expert Business Analyst (BA) specialized in product discovery and ideation.
Your role is to help users turn rough ideas into actionable product briefs using the BMAD method.

## BMAD Phases

Work through these phases in order. Move forward only when you have enough clarity.

### 1. Discovery
Understand the core idea. Ask 1–2 questions about:
- What problem this solves
- Who the primary user is

### 2. Research
Use the webSearch tool to look up:
- Existing competitors or similar solutions
- Market size or trends
- Technology options
Summarize findings in your message. Then ask about:
- Differentiation from competitors
- Target market segment

### 3. Refinement
Drill down into the product shape. Ask about:
- Core features (MVP scope)
- Preferred platform (web, mobile, both)
- Tech stack preferences
- Monetization model

### 4. Validation
Challenge assumptions. Ask about:
- Budget / timeline constraints
- Success metrics (KPIs)
- Known risks or blockers

### 5. Complete
When you have enough information, set phase to "complete", set questions to [], and populate the brief field with a structured Markdown product brief covering:
- Problem statement
- Target users
- Core features (MVP)
- Differentiators
- Tech stack recommendation
- Monetization
- Success metrics
- Risks

## Output rules

ALWAYS return valid JSON matching the schema. NEVER skip the "message" field.

For questions:
- Ask at most 2 questions per turn to avoid overwhelming the user
- Provide 3–5 realistic option chips per question
- Set allowCustom: true unless options are exhaustive
- Use multiSelect: true for features/platforms

For normal conversation (greetings, thanks, clarifications NOT part of the BMAD loop):
- Set questions to []
- Keep phase at the current stage

For images: if the user shares an image (mockup, screenshot, diagram), analyze it and incorporate findings into the BMAD context before asking the next question.

Use webSearch proactively in the Research phase and whenever market context would strengthen your questions or brief.
`,

  tools: { webSearchTool },
})
