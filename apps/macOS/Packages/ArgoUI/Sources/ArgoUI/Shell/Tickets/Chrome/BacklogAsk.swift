/// Where one backlog question has got to, and what the surface may do about it (#1317).
///
/// The state is held ABOVE the room, like the query and the seam: the panes are rebuilt on every
/// ticket, and an answer owned any lower would be lost by the first click that changed anything.
///
/// **A question is not held.** It is not the Project's, it does not survive a room switch, and it
/// never reaches the heading — which keeps reading `view · grouping · count` off the query's own
/// honest arithmetic. `TicketsChromeProjection` builds `n results` from `narrowing.matches`, and
/// nothing here goes near that path.
///
/// **Nothing asked and nothing to ask with is `BacklogAsk()`** — the memberwise defaults, and not
/// a named static, for a `#Preview` and a specimen with no port behind them.
///
/// Every verb is `@MainActor`, which is what makes the value `Sendable` and so what lets
/// `TicketsRoom.Held.unheld` stay a `static let`: a global-actor-isolated closure is Sendable, a
/// bare one is not. It is the same spelling `Held.opened` already carries, for the same reason.
package struct BacklogAsk: Sendable {
    package var state = State.unasked
    /// Ask what is typed, over the tickets named. Takes both rather than reading either, so the
    /// string the sheet heads itself with is the string that was asked, and the numbers the answer
    /// is about are the ones the list is the authority on.
    var ask: @MainActor (String, [Int]) -> Void = { _, _ in }
    /// Abandon a question in flight. Its own verb and not `close`: stopping ends a child process
    /// and leaves the room where it was, where closing dismisses an answer that arrived.
    var stop: @MainActor () -> Void = {}
    var close: @MainActor () -> Void = {}

    /// The three readings, and there is no fourth in this ticket: the failure states and the
    /// vacancy are #1320's, and a case drawn here before it has a surface would be a state nobody
    /// can reach (#872).
    package enum State: Equatable {
        /// Nothing asked — which is every room until somebody presses `⌘⏎`, and the state a
        /// closed answer returns to.
        case unasked
        /// A model is reading. The question is carried so the sheet can head itself with it while
        /// the prose is still coming.
        case asking(question: String)
        /// Raw prose, verbatim, and whether a model actually produced it. Citations and
        /// attribution are #1319's and #1318's — this ticket is the tracer bullet, and it is done
        /// when somebody can ask and read the answer.
        ///
        /// `read` is `false` for a REFUSAL, whose sentence draws in the same place (#1320 gives
        /// the failures a surface of their own). It is not styling: the sheet states what the
        /// answer read, and stating that over a read which never happened is a false DIRECT
        /// (`docs/domain/honesty-tier.md`, degrade-down).
        case answered(question: String, prose: String, read: Bool)

        /// The question this state is about, and `nil` before one was asked. What the sheet heads
        /// itself with, so the head does not switch strings when the prose lands.
        var question: String? {
            switch self {
            case .unasked: nil
            case let .asking(question): question
            case let .answered(question, _, _): question
            }
        }

        /// The prose, and `nil` while a model is still reading. Read beside `question` so the
        /// sheet is built from ONE value in both states — see `TicketsRoom.answer`.
        var prose: String? {
            switch self {
            case .unasked, .asking: nil
            case let .answered(_, prose, _): prose
            }
        }

        /// Whether the sheet may state what the answer read. False until there IS an answer, and
        /// false for a refusal.
        var wasRead: Bool {
            switch self {
            case .unasked, .asking: false
            case let .answered(_, _, read): read
            }
        }
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal`, and the
    /// specimens build this from their own target (#1085).
    package init(
        state: State = .unasked,
        ask: @escaping @MainActor (String, [Int]) -> Void = { _, _ in },
        stop: @escaping @MainActor () -> Void = {},
        close: @escaping @MainActor () -> Void = {},
    ) {
        self.state = state
        self.ask = ask
        self.stop = stop
        self.close = close
    }
}
