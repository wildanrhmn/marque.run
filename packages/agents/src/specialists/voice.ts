import type { SpecialistDefinition, SpecialistRunArgs } from "../specialist"

interface VeniceTtsBody {
  model: string
  voice: string
  input: string
  response_format: "mp3" | "wav" | "opus"
}

export interface VoiceOutput {
  base64: string
  mimeType: string
}

export const voiceSpecialist: SpecialistDefinition<VeniceTtsBody, VoiceOutput> = {
  kind: "voice",
  buildVeniceBody: (run: SpecialistRunArgs) => ({
    model: (run.parameters.model as string | undefined) ?? "venice-tts-1",
    voice: (run.parameters.voice as string | undefined) ?? "river",
    input: run.prompt,
    response_format: "mp3",
  }),
  parseResult: (raw): VoiceOutput => {
    if (raw instanceof ArrayBuffer) {
      const bytes = new Uint8Array(raw)
      return {
        base64: Buffer.from(bytes).toString("base64"),
        mimeType: "audio/mpeg",
      }
    }
    if (typeof raw === "string") {
      return { base64: raw, mimeType: "audio/mpeg" }
    }
    const env = raw as { audio?: string; base64?: string }
    const b64 = env.audio ?? env.base64
    if (!b64) throw new Error("voice specialist: no audio from venice")
    return { base64: b64, mimeType: "audio/mpeg" }
  },
}
