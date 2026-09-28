import type { PermissionDecision } from '@/domains/sessions/api/permissions'
import {
  type Question,
  type QuestionAnswer,
  validQuestionAnswers,
} from '@/domains/sessions/api/questions'

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

export class SessionInteractionBroker {
  private readonly pending = new Map<string, Pending>()

  private wait<Value>(
    key: string,
    signal: AbortSignal,
    create: (resolve: (answer: Value) => void) => Pending,
  ): Promise<Value> {
    if (this.pending.has(key)) throw new Error('Duplicate Session interaction request.')
    if (signal.aborted) return Promise.reject(new Error('Session interaction was cancelled.'))
    return new Promise<Value>((resolve, reject) => {
      const cancel = () => {
        this.pending.delete(key)
        reject(new Error('Session interaction was cancelled.'))
      }
      signal.addEventListener('abort', cancel, { once: true })
      this.pending.set(
        key,
        create((answer) => {
          signal.removeEventListener('abort', cancel)
          this.pending.delete(key)
          resolve(answer)
        }),
      )
    })
  }

  requestPermission(request: {
    nativeId: string
    requestId: string
    description: string
    signal: AbortSignal
  }): Promise<PermissionDecision> {
    const { nativeId, requestId, description, signal } = request
    return this.wait(`${nativeId}:${requestId}`, signal, (resolve) => ({
      kind: 'permission',
      nativeId,
      requestId,
      description,
      resolve,
    }))
  }

  requestQuestion(request: {
    nativeId: string
    requestId: string
    questions: Question[]
    signal: AbortSignal
  }): Promise<QuestionAnswer[]> {
    const { nativeId, requestId, questions, signal } = request
    return this.wait(`${nativeId}:${requestId}`, signal, (resolve) => ({
      kind: 'question',
      nativeId,
      requestId,
      questions,
      resolve,
    }))
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
    if (request?.kind !== 'question' || !validQuestionAnswers(request.questions, answers))
      return false
    request.resolve(answers)
    return true
  }
}
