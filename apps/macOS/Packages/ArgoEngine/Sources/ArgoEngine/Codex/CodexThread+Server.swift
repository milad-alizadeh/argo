import Foundation

/// What the server says back, and what it makes the thread do. Separate from the acts the port
/// raises, because this half is driven by the CLI's clock rather than by the user's.
@MainActor
extension CodexThread {
    func apply(_ message: CodexServerMessage) {
        switch message {
        case let .answer(id, result): answered(id, result: result)
        case let .request(id, method, params): answer(id, asking: method, params: params)
        case let .notification(method, params): noticed(method, params: params)
        case let .failure(id): failed(id)
        }
    }

    private func answered(_ id: Int, result: JSONValue) {
        if id == initializeID {
            return openThread()
        }
        guard id == threadStartID,
              let threadID = result["thread"]?.stringField("id") else { return }
        opened(threadID)
    }

    /// A refused `turn/start` is one Turn's failure and the thread lives on. A refused handshake is
    /// the thread itself: nothing after it can be sent, so the wait ends rather than lasting for
    /// ever.
    private func failed(_ id: Int) {
        guard id == initializeID || id == threadStartID else { return }
        refuse()
    }

    /// A patch's content reaches Argo on the ITEM rather than on the approval that gates it, so
    /// both notifications carrying `changes` are read. A prompt already raised keeps the target it
    /// was raised with: what the user is reading may not change under them mid-decision.
    private func noticed(_ method: String, params: JSONValue) {
        switch method {
        case "turn/started": noted(turn: params["turn"]?.stringField("id"))
        case "turn/completed":
            noted(turn: nil)
            approvals.completedTurn()
        case "item/started": noted(patch: params["item"] ?? .null)
        case "item/fileChange/patchUpdated": noted(patch: params)
        default: break
        }
    }

    /// One item's file changes, under whichever key the notification spells its id. `item/started`
    /// carries the whole item and calls it `id`; `patchUpdated` names the `itemId` beside them.
    private func noted(patch: JSONValue) {
        guard let changes = patch["changes"]?.array, !changes.isEmpty,
              let itemID = patch.stringField("id") ?? CodexAsk.itemID(patch)
        else { return }
        approvals.noted(patch: itemID, changes: changes)
    }

    /// Every server→client request is answered, because the server keeps no clock of its own and an
    /// unanswered one holds the Turn open for ever (openai/codex#11816).
    ///
    /// An approval becomes a Permission the user can see (#549), and Argo's own clock answers it
    /// if nobody does. Anything else is refused as unsupported rather than answered in a shape
    /// guessed at — including the server's third approval, whose response carries a permission
    /// profile this cockpit has no control for.
    private func answer(_ id: Int, asking method: String, params: JSONValue) {
        guard let asked = CodexApprovalAsk(id: id, method: method, params: params) else {
            return put(CodexRPC.unsupported(id: id, method: method))
        }
        approvals.raise(asked)
    }
}
