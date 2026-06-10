import type { SpecialistDefinition, SpecialistRunArgs } from "../specialist"

interface VeniceVideoBody {
  model: string
  prompt: string
  duration: "5s" | "10s"
  resolution: string
  aspect_ratio: string
  image_url?: string
  negative_prompt?: string
}

export interface VideoOutput {
  base64: string
  mimeType: string
  taskId?: string
}

export const videoSpecialist: SpecialistDefinition<VeniceVideoBody, VideoOutput> = {
  kind: "video",
  buildVeniceBody: (run: SpecialistRunArgs) => {
    const secs = (run.parameters.durationSeconds as number | undefined) ?? 5
    const referenceImage = run.parameters.imageUrl as string | undefined
    const body: VeniceVideoBody = {
      model: referenceImage ? "seedance-2-0-fast-image-to-video" : "seedance-2-0-fast-text-to-video",
      prompt: run.prompt,
      duration: secs > 5 ? "10s" : "5s",
      resolution: (run.parameters.resolution as string | undefined) ?? "720p",
      aspect_ratio: (run.parameters.aspectRatio as string | undefined) ?? "16:9",
    }
    if (referenceImage) body.image_url = referenceImage
    return body
  },
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
