import type { BrowserWindow } from 'electron'
import { isTrustedRendererFrame } from '../security/is-trusted-renderer-frame'
import type {
  MainErrorCode,
  Operation,
  OperationTable,
  ReplyEnvelope,
  ReplyOf,
  RequestOf,
} from '@/shared/ipc/operations'
import { isOtherVersion } from '@/shared/messages'
import { requestIdentifier } from '@/shared/validation'

export function registerDomainHandlers<Operations extends OperationTable, Context>(config: {
  window: BrowserWindow
  rendererURL: string
  operations: Operations
  context: Context
  handlers: {
    [Key in keyof Operations]: (
      request: RequestOf<Operations[Key]>,
      context: Context,
    ) => Promise<ReplyOf<Operations[Key]>> | ReplyOf<Operations[Key]>
  }
  error: (code: MainErrorCode, requestId: string | null) => unknown
}): void {
  const { window, rendererURL, operations, context, handlers, error } = config

  function registerOperation<Request, Reply extends ReplyEnvelope>(
    operation: Operation<Request, Reply>,
    handler: (request: Request, context: Context) => Promise<Reply> | Reply,
  ): void {
    window.webContents.ipc.handle(operation.channel, (event, request: unknown) => {
      if (!isTrustedRendererFrame(event, window, rendererURL)) {
        return error('access-denied', requestIdentifier(request))
      }
      if (isOtherVersion(request)) {
        return error('unsupported-version', requestIdentifier(request))
      }
      const parsed = operation.request.safeParse(request)
      if (!parsed.success) return error('invalid-request', requestIdentifier(request))
      return handler(parsed.data, context)
    })
  }

  for (const key of Object.keys(operations) as Array<keyof Operations>) {
    const operation = operations[key] as Operation<
      RequestOf<Operations[typeof key]>,
      ReplyOf<Operations[typeof key]>
    >
    registerOperation(operation, handlers[key])
  }
}
