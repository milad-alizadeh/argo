import type { PermissionDecision } from '@/domains/sessions/api/permissions'
import type { Question, QuestionAnswer } from '@/domains/sessions/api/questions'

type PendingPermission = {
  kind: 'permission'
  nativeId: string
  requestId: string
  description: string
  resolve: (decision: PermissionDecision) => void
}

type PendingQuestion = {
  kind: 'question'
  nativeId: string
  requestId: string
  questions: Question[]
  resolve: (answers: QuestionAnswer[]) => void
}

type Pending = PendingPermission | PendingQuestion
type PendingRequest = Omit<PendingPermission, 'resolve'> | Omit<PendingQuestion, 'resolve'>

export class SessionInteractionBroker {
  private readonly pending = new Map<string, Pending>()

  private wait<Value>(request: PendingRequest, signal: AbortSignal): Promise<Value> {
    const key = `${request.nativeId}:${request.requestId}`
    if (this.pending.has(key)) throw new Error('Duplicate Session interaction request.')
    if (signal.aborted) return Promise.reject(new Error('Session interaction was cancelled.'))
    return new Promise<Value>((resolve, reject) => {
      const cancel = () => {
        this.pending.delete(key)
        reject(new Error('Session interaction was cancelled.'))
      }
      signal.addEventListener('abort', cancel, { once: true })
      this.pending.set(key, {
        ...request,
        resolve: (answer: PermissionDecision | QuestionAnswer[]) => {
          signal.removeEventListener('abort', cancel)
          this.pending.delete(key)
          resolve(answer as Value)
        },
      } as Pending)
    })
  }

  requestPermission(request: {
    nativeId: string
    requestId: string
    description: string
    signal: AbortSignal
  }): Promise<PermissionDecision> {
    const { signal, ...pending } = request
    return this.wait({ kind: 'permission', ...pending }, signal)
  }

  requestQuestion(request: {
    nativeId: string
    requestId: string
    questions: Question[]
    signal: AbortSignal
  }): Promise<QuestionAnswer[]> {
    const { signal, ...pending } = request
    return this.wait({ kind: 'question', ...pending }, signal)
  }

  permission(nativeId: string): Pick<PendingPermission, 'requestId' | 'description'> | null {
    const request = [...this.pending.values()].find(
      (pending) => pending.nativeId === nativeId && pending.kind === 'permission',
    )
    return request?.kind === 'permission'
      ? { requestId: request.requestId, description: request.description }
      : null
  }

  decidePermission(nativeId: string, requestId: string, decision: PermissionDecision): boolean {
    const request = this.pending.get(`${nativeId}:${requestId}`)
    if (request?.kind !== 'permission') return false
    request.resolve(decision)
    return true
  }

  decideQuestion(nativeId: string, requestId: string, answers: QuestionAnswer[]): boolean {
    const request = this.pending.get(`${nativeId}:${requestId}`)
    if (request?.kind !== 'question' || request.questions.length !== answers.length) return false
    if (
      !answers.every((answer, position) => {
        const question = request.questions[position]
        if (question === undefined) return false
        if (answer.kind === 'text')
          return answer.index === question.options.length + 1 && answer.text.trim() !== ''
        return (
          (question.multiSelect || answer.indices.length === 1) &&
          answer.indices.every((index) => index >= 1 && index <= question.options.length)
        )
      })
    )
      return false
    request.resolve(answers)
    return true
  }
}
