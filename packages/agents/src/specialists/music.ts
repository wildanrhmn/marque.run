import type { SpecialistDefinition, SpecialistRunArgs } from "../specialist"

interface VeniceMusicBody {
  model: string
  prompt: string
  duration: number
  output_format: "mp3" | "wav"
}

export interface MusicOutput {
  base64: string
  mimeType: string
}

export const musicSpecialist: SpecialistDefinition<VeniceMusicBody, MusicOutput> = {
  kind: "music",
  buildVeniceBody: (run: SpecialistRunArgs) => ({
    model: "venice-music-1",
    prompt: run.prompt,
    duration: (run.parameters.durationSeconds as number | undefined) ?? 30,
    output_format: "mp3",
  }),
  parseResult: (raw): MusicOutput => {
    if (raw instanceof ArrayBuffer) {
      const bytes = new Uint8Array(raw)
      return { base64: Buffer.from(bytes).toString("base64"), mimeType: "audio/mpeg" }
    }
    const env = raw as { audio?: string; base64?: string; url?: string }
    if (env.audio) return { base64: env.audio, mimeType: "audio/mpeg" }
    if (env.base64) return { base64: env.base64, mimeType: "audio/mpeg" }
    throw new Error("music specialist: no audio from venice")
  },
}
