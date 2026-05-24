import type { DirectorRunResult } from "./director"

export interface ComposedAsset {
  mimeType: "video/mp4"
  data: Uint8Array
  durationMs: number
  scenesUsed: number
}

export interface ComposerOptions {
  ffmpegPath?: string
  workDir?: string
}

export interface Composer {
  compose: (result: DirectorRunResult) => Promise<ComposedAsset>
}

export function createPlaceholderComposer(_opts: ComposerOptions = {}): Composer {
  return {
    async compose(result) {
      const videoBase64 = result.video.base64
      const data =
        typeof Buffer !== "undefined"
          ? new Uint8Array(Buffer.from(videoBase64, "base64"))
          : Uint8Array.from(atob(videoBase64), (c) => c.charCodeAt(0))
      const totalMs = result.plan.composition.scenes.reduce((acc, s) => acc + s.durationMs, 0)
      return {
        mimeType: "video/mp4",
        data,
        durationMs: totalMs,
        scenesUsed: result.images.length,
      }
    },
  }
}
