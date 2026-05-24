import type { SpecialistDefinition, SpecialistRunArgs } from "../specialist"

interface VeniceChatBody {
  model: string
  messages: { role: "system" | "user" | "assistant"; content: string }[]
  temperature?: number
  max_tokens?: number
  response_format?: { type: "json_object" }
}

export interface ConceptOutput {
  hook: string
  scenes: { description: string; voiceLine: string; durationMs: number }[]
  musicPrompt: string
  brand: { name: string; palette: string[] }
}

const SYSTEM = `You are the creative director inside DELEGATE.RUN, a serverless agent runtime.
Given a brief, output a JSON object with: hook (one sentence), scenes (array of 3 to 5 with description, voiceLine, durationMs summing to about 30000), musicPrompt, brand { name, palette of 3 hex colors }.
Output JSON only, no prose.`

export const conceptSpecialist: SpecialistDefinition<VeniceChatBody, ConceptOutput> = {
  kind: "concept",
  buildVeniceBody: (run: SpecialistRunArgs) => ({
    model: "venice-uncensored",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: run.prompt },
    ],
    temperature: 0.7,
    max_tokens: 1200,
    response_format: { type: "json_object" },
  }),
  parseResult: (raw): ConceptOutput => {
    const envelope = raw as { choices?: { message?: { content?: string } }[] }
    const content = envelope?.choices?.[0]?.message?.content
    if (!content) throw new Error("concept specialist: no content from venice")
    return JSON.parse(content) as ConceptOutput
  },
}
