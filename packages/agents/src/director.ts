import type { Hex } from "viem"
import type { Delegation } from "@marque/delegation"
import type { BriefRequest, DirectorPlan, SpecialistKind, SpecialistTask } from "@marque/shared"
import type { BrokerClient } from "./broker-client"
import { createSpecialistRunner, type SpecialistOutput } from "./specialist"
import { conceptSpecialist, type ConceptOutput } from "./specialists/concept"
import { imageSpecialist, type ImageOutput } from "./specialists/image"
import { voiceSpecialist, type VoiceOutput } from "./specialists/voice"
import { musicSpecialist, type MusicOutput } from "./specialists/music"
import { videoSpecialist, type VideoOutput } from "./specialists/video"

export interface DirectorRunInput {
  briefId: Hex
  brief: BriefRequest
  rootBudgetAtoms: bigint
  perCallAllowance: Record<SpecialistKind, bigint>
  signRedelegationFor: (kind: SpecialistKind, taskAmountAtoms: bigint) => Promise<Delegation[]>
  onPlan?: (plan: DirectorPlan) => void
  onSpecialistResult?: (kind: SpecialistKind, output: SpecialistOutput<unknown>) => void
}

export interface DirectorRunResult {
  plan: DirectorPlan
  concept: ConceptOutput
  images: ImageOutput[]
  voice: VoiceOutput
  music: MusicOutput
  video: VideoOutput
}

export class Director {
  constructor(private readonly broker: BrokerClient) {}

  private async runConcept(input: DirectorRunInput): Promise<ConceptOutput> {
    const runner = createSpecialistRunner({ broker: this.broker, definition: conceptSpecialist })
    const delegationChain = await input.signRedelegationFor("concept", input.perCallAllowance.concept)
    const output = await runner({
      briefId: input.briefId,
      prompt: input.brief.prompt,
      parameters: { durationSeconds: input.brief.durationSeconds },
      delegationChain,
      amountAtoms: input.perCallAllowance.concept,
    })
    input.onSpecialistResult?.("concept", output)
    return output.data
  }

  private buildPlan(concept: ConceptOutput, brief: BriefRequest, briefId: Hex): DirectorPlan {
    const tasks: SpecialistTask[] = [
      ...concept.scenes.map(
        (scene): SpecialistTask => ({
          kind: "image" as SpecialistKind,
          budgetUsdc: "0.40",
          prompt: scene.description,
          parameters: { stylePrompt: concept.brand.palette.join(", ") + " mood, cinematic" },
        }),
      ),
      {
        kind: "voice",
        budgetUsdc: "0.10",
        prompt: concept.scenes.map((s) => s.voiceLine).join(" "),
        parameters: { voice: "river" },
      },
      {
        kind: "music",
        budgetUsdc: "0.30",
        prompt: concept.musicPrompt,
        parameters: { durationSeconds: brief.durationSeconds },
      },
      {
        kind: "video",
        budgetUsdc: "0.80",
        prompt: `${concept.hook}. ${concept.scenes[0]?.description ?? ""}`,
        parameters: { durationSeconds: Math.min(brief.durationSeconds, 8) },
      },
    ]

    return {
      briefId,
      storyboard: concept.hook,
      tasks,
      composition: {
        scenes: concept.scenes.map((s, i) => ({
          imageIndex: i,
          voiceIndex: i,
          musicSegment: i,
          durationMs: s.durationMs,
        })),
      },
    }
  }

  async run(input: DirectorRunInput): Promise<DirectorRunResult> {
    const concept = await this.runConcept(input)
    const plan = this.buildPlan(concept, input.brief, input.briefId)
    input.onPlan?.(plan)

    const imageRunner = createSpecialistRunner({ broker: this.broker, definition: imageSpecialist })
    const voiceRunner = createSpecialistRunner({ broker: this.broker, definition: voiceSpecialist })
    const musicRunner = createSpecialistRunner({ broker: this.broker, definition: musicSpecialist })
    const videoRunner = createSpecialistRunner({ broker: this.broker, definition: videoSpecialist })

    const imageTasks = plan.tasks.filter((t) => t.kind === "image")
    const voiceTask = plan.tasks.find((t) => t.kind === "voice")
    const musicTask = plan.tasks.find((t) => t.kind === "music")
    const videoTask = plan.tasks.find((t) => t.kind === "video")
    if (!voiceTask || !musicTask || !videoTask) throw new Error("plan missing required tasks")

    const [voiceDelegation, musicDelegation, videoDelegation] = await Promise.all([
      input.signRedelegationFor("voice", input.perCallAllowance.voice),
      input.signRedelegationFor("music", input.perCallAllowance.music),
      input.signRedelegationFor("video", input.perCallAllowance.video),
    ])

    const imageResults: ImageOutput[] = []
    for (const task of imageTasks) {
      const delegationChain = await input.signRedelegationFor("image", input.perCallAllowance.image)
      const out = await imageRunner({
        briefId: input.briefId,
        prompt: task.prompt,
        parameters: task.parameters,
        delegationChain,
        amountAtoms: input.perCallAllowance.image,
      })
      input.onSpecialistResult?.("image", out)
      imageResults.push(out.data)
    }

    const [voice, music, video] = await Promise.all([
      voiceRunner({
        briefId: input.briefId,
        prompt: voiceTask.prompt,
        parameters: voiceTask.parameters,
        delegationChain: voiceDelegation,
        amountAtoms: input.perCallAllowance.voice,
      }),
      musicRunner({
        briefId: input.briefId,
        prompt: musicTask.prompt,
        parameters: musicTask.parameters,
        delegationChain: musicDelegation,
        amountAtoms: input.perCallAllowance.music,
      }),
      videoRunner({
        briefId: input.briefId,
        prompt: videoTask.prompt,
        parameters: videoTask.parameters,
        delegationChain: videoDelegation,
        amountAtoms: input.perCallAllowance.video,
      }),
    ])

    input.onSpecialistResult?.("voice", voice)
    input.onSpecialistResult?.("music", music)
    input.onSpecialistResult?.("video", video)

    return {
      plan,
      concept,
      images: imageResults,
      voice: voice.data,
      music: music.data,
      video: video.data,
    }
  }
}
