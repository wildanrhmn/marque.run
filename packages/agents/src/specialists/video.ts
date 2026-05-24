import type { SpecialistDefinition, SpecialistRunArgs } from "../specialist"

interface VeniceVideoBody {
  model: string
  prompt: string
  duration: number
  width: number
  height: number
  fps: number
}

export interface VideoOutput {
  base64: string
  mimeType: string
  taskId?: string
}

export const videoSpecialist: SpecialistDefinition<VeniceVideoBody, VideoOutput> = {
  kind: "video",
  buildVeniceBody: (run: SpecialistRunArgs) => ({
    model: "venice-video-1",
    prompt: run.prompt,
    duration: (run.parameters.durationSeconds as number | undefined) ?? 5,
    width: 1280,
    height: 720,
    fps: 24,
  }),
  parseResult: (raw): VideoOutput => {
    if (raw instanceof ArrayBuffer) {
      const bytes = new Uint8Array(raw)
      return { base64: Buffer.from(bytes).toString("base64"), mimeType: "video/mp4" }
    }
    const env = raw as { video?: string; base64?: string; taskId?: string; url?: string }
    if (env.video) return { base64: env.video, mimeType: "video/mp4", taskId: env.taskId }
    if (env.base64) return { base64: env.base64, mimeType: "video/mp4", taskId: env.taskId }
    throw new Error("video specialist: no video from venice")
  },
}
