type ContractErrorReply = {
  code: string
  message: string
  requestId: string | null
  type: string
}

export class ContractError<Reply extends ContractErrorReply> extends Error {
  version: 1 = 1
  type: Reply['type']
  requestId: string | null
  code: Reply['code']

  constructor({ code, message, requestId, type }: Reply) {
    super(message)
    this.type = type
    this.requestId = requestId
    this.code = code
  }
}
