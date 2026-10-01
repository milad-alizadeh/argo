import { z } from 'zod'

const metadataSchema = z.object({
  producer: z.enum(['claude-cli', 'codex-app-server', 'claude-acp']),
  version: z.string().min(1),
  recordedAt: z.union([z.iso.date(), z.iso.datetime()]).nullable(),
})

export type RecordingMetadata = z.infer<typeof metadataSchema>

export function recordingLocation(file: string) {
  const [producer, version, name] = file.split('/').slice(-3)
  if (!producer || !version || !name) throw new Error(`Invalid recording path ${file}.`)
  return { producer, version }
}

export function loadRecording<Value>(file: string, value: Value): Value {
  const { producer, version } = recordingLocation(file)
  const metadata = metadataSchema
    .extend({
      producer: metadataSchema.shape.producer.refine((value) => value === producer),
      version: z.literal(version),
    })
    .safeParse(value)
  if (!metadata.success) {
    const fields = metadata.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    throw new Error(`Invalid recording ${file}: ${fields.join('; ')}`, { cause: metadata.error })
  }
  return value
}
