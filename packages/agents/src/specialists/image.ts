import type { SpecialistDefinition, SpecialistRunArgs } from "../specialist"

interface VeniceImageBody {
  model: string
  prompt: string
  negative_prompt?: string
  width: number
  height: number
  steps?: number
  cfg_scale?: number
}

export interface ImageOutput {
  base64: string
  mimeType: string
}

export const imageSpecialist: SpecialistDefinition<VeniceImageBody, ImageOutput> = {
  kind: "image",
  buildVeniceBody: (run: SpecialistRunArgs) => {
    const stylePrompt = (run.parameters.stylePrompt as string | undefined) ?? ""
    return {
      model: "venice-sd35",
      prompt: `${run.prompt}. ${stylePrompt}`.trim(),
      negative_prompt: "low quality, watermark, text overlay",
      width: 1024,
      height: 576,
      steps: 30,
      cfg_scale: 6.5,
    }
  },
  parseResult: (raw): ImageOutput => {
    const env = raw as {
      images?: { image?: string; base64?: string }[]
      data?: { b64_json?: string; url?: string }[]
    }
    const b64 = env?.images?.[0]?.base64 ?? env?.images?.[0]?.image ?? env?.data?.[0]?.b64_json
    if (!b64) throw new Error("image specialist: no image data from venice")
    return { base64: b64, mimeType: "image/png" }
  },
}
