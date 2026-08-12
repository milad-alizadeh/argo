import Foundation

/// What the server says back, and what it makes the thread do. Separate from the acts the port
/// raises, because this half is driven by the CLI's clock rather than by the user's.
@MainActor
extension CodexThread {
    func apply(_ message: CodexServerMessage) {
        switch message {
        case let .answer(id, result): answered(id, result: result)
        case let .request(id, method, _): answer(id, asking: method)
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

    private func noticed(_ method: String, params: JSONValue) {
        switch method {
        case "turn/started": noted(turn: params["turn"]?.stringField("id"))
        case "turn/completed": noted(turn: nil)
        default: break
        }
    }

    /// Every server→client request is answered, because the server keeps no clock of its own and an
    /// unanswered one holds the Turn open for ever (openai/codex#11816).
    ///
    /// An approval is declined until #549 raises it as a Permission the user can see. Declining
    /// refuses that one action and lets the Turn continue — the boundary answering "no" while
    /// nobody can be asked, which is the way round every unanswered Permission in Argo resolves.
    /// Anything else is refused as unsupported rather than answered in a shape guessed at.
    private func answer(_ id: Int, asking method: String) {
        put(method.hasSuffix("/requestApproval")
            ? CodexRPC.result(id: id, ["decision": .string("decline")])
            : CodexRPC.unsupported(id: id, method: method))
    }
}
