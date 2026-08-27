/// The Turn in flight, and what the last one ended as (`CONTEXT.md` L3 · Turn).
///
/// A question only waits while the Turn that put it is open, so ending the Turn drops it whether or
/// not an answer ever came back — which is the rule these three facts move together under.
struct SessionTurnState: Equatable, Sendable {
    private(set) var isOpen = false
    private(set) var lastStop: StopReason?
    /// The `AskUserQuestion` calls in the open Turn that no result has answered.
    private var pendingAsks: Set<String> = []

    var hasPendingAsk: Bool {
        !pendingAsks.isEmpty
    }

    init(lastStop: StopReason? = nil) {
        self.lastStop = lastStop
    }

    mutating func opened() {
        isOpen = true
    }

    /// A question the Turn it was asked in has left behind is not still waiting on anyone.
    mutating func ended(_ reason: StopReason) {
        isOpen = false
        lastStop = reason
        pendingAsks = []
    }

    /// One call the agent emitted, of which only a question makes the Turn wait.
    mutating func observe(_ call: ToolCall) {
        guard call.name == ToolCall.askUserQuestion else { return }
        pendingAsks.insert(call.id)
    }

    mutating func answered(_ callID: String) {
        pendingAsks.remove(callID)
    }

    /// A resume file with no Turn in it yet says nothing about the chain, and taking its silence
    /// would close the root's open Turn.
    mutating func merge(_ continuation: Self) {
        guard continuation.isOpen || continuation.lastStop != nil else { return }
        self = continuation
    }
}
