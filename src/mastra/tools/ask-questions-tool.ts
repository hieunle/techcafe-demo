import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

const BAQuestionSchema = z.object({
  id: z.string().describe('Short snake_case slug unique per question'),
  question: z.string().describe('The question text to display'),
  options: z.array(z.string()).describe('3–5 realistic choices to display as chips'),
  allowCustom: z.boolean().describe('Whether to show a free-text input for a custom answer'),
  multiSelect: z.boolean().describe('true = multiple choices allowed, false = single choice only'),
})

const BAPhaseSchema = z.enum(['discovery', 'research', 'refinement', 'validation', 'complete'])

/**
 * Tool called by the BA agent whenever it wants to surface structured questions
 * to the user. Instead of embedding JSON in a hidden HTML comment, the agent
 * calls this tool and we emit the data as a `data-ba-questions` stream chunk
 * which the AI SDK delivers as a DataUIPart in `msg.parts` on the frontend.
 *
 * After writing the questions chunk the tool calls suspend(), which hard-terminates
 * the current stream so the agent cannot continue generating. The agent resumes
 * automatically (via autoResumeSuspendedTools) when the user sends their next
 * message (the answers), at which point execute() is called again with resumeData.
 */
export const askQuestionsTool = createTool({
  id: 'askQuestions',
  description:
    'Surface structured questions to the user during the BMAD discovery process. Call this after writing your conversational message whenever you want to show the questions panel with clickable answer chips. Pass the current phase, 0–2 question objects, and optionally the final product brief when phase is "complete".',
  inputSchema: z.object({
    phase: BAPhaseSchema.describe('Current BMAD phase'),
    questions: z
      .array(BAQuestionSchema)
      .max(2)
      .describe('0–2 questions to display. Use [] for research/tool turns or the complete phase.'),
    brief: z
      .string()
      .optional()
      .describe('Full product brief markdown, populated only when phase is "complete"'),
  }),
  outputSchema: z.object({
    acknowledged: z.boolean(),
  }),
  suspendSchema: z.object({
    phase: BAPhaseSchema,
    questions: z.array(BAQuestionSchema),
    brief: z.string().optional(),
  }),
  resumeSchema: z.object({
    answered: z.boolean().describe('true once the user has submitted their answers'),
  }),
  execute: async (inputData, context) => {
    const { suspend, resumeData } = context?.agent ?? {}

    if (resumeData?.answered) {
      return { acknowledged: true }
    }

    await context?.writer?.custom({
      type: 'data-ba-questions',
      data: {
        phase: inputData.phase,
        questions: inputData.questions,
        brief: inputData.brief,
      },
    })

    return suspend?.({ phase: inputData.phase, questions: inputData.questions, brief: inputData.brief })
  },
})
