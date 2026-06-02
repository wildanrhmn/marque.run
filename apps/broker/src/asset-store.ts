import { createHash } from "crypto"
import { mkdir, writeFile, readFile, stat } from "fs/promises"
import { join, resolve } from "path"
import { logger } from "./log"

const ROOT = resolve(process.env.BROKER_ASSET_DIR ?? "/var/lib/marque-broker/assets")

async function ensureRoot(): Promise<void> {
  await mkdir(ROOT, { recursive: true })
}

export function cidOf(buf: Buffer): string {
  return "sha256-" + createHash("sha256").update(buf).digest("hex").slice(0, 32)
}

export interface StoreAssetArgs {
  data: Buffer
  contentType: string
  filename?: string
}

export interface StoredAsset {
  cid: string
  contentType: string
  filename: string
  bytes: number
  path: string
}

export async function storeAsset(args: StoreAssetArgs): Promise<StoredAsset> {
  await ensureRoot()
  const cid = cidOf(args.data)
  const ext =
    args.contentType.startsWith("video/")
      ? ".mp4"
      : args.contentType.startsWith("image/")
        ? ".png"
        : args.contentType.startsWith("audio/")
          ? ".mp3"
          : ".bin"
  const filename = args.filename ?? `${cid}${ext}`
  const path = join(ROOT, filename)
  await writeFile(path, args.data)
  logger.info({ cid, bytes: args.data.byteLength, path }, "stored asset")
  return { cid, contentType: args.contentType, filename, bytes: args.data.byteLength, path }
}

export async function storeJson(name: string, value: unknown): Promise<{ cid: string; path: string }> {
  await ensureRoot()
  const json = JSON.stringify(value, null, 2)
  const buf = Buffer.from(json, "utf8")
  const cid = cidOf(buf)
  const filename = `${name}-${cid}.json`
  const path = join(ROOT, filename)
  await writeFile(path, buf)
  return { cid, path }
}

export async function readAsset(filename: string): Promise<{ data: Buffer; contentType: string }> {
  await ensureRoot()
  const path = join(ROOT, filename)
  const data = await readFile(path)
  const contentType = filename.endsWith(".mp4")
    ? "video/mp4"
    : filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".mp3")
        ? "audio/mpeg"
        : filename.endsWith(".json")
          ? "application/json"
          : "application/octet-stream"
  return { data, contentType }
}

export async function assetExists(filename: string): Promise<boolean> {
  try {
    await stat(join(ROOT, filename))
    return true
  } catch {
    return false
  }
}

export function assetRoot(): string {
  return ROOT
}
