/// The Session's standing autonomy stance — a four-rung ladder whose rungs are BOUNDARIES rather
/// than prompt frequencies: inside a rung the agent acts, at its edge a Permission fires
/// (`CONTEXT.md` L2 · Autonomy, ADR-0025).
public enum SessionMode: CaseIterable, Hashable, Sendable {
    /// No writes are possible.
    case readOnly
    /// Read Only's boundary carrying a deliverable: the agent proposes, then hands off. Shares
    /// `readOnly`'s permission level and differs by INTENT, so an edit must not collapse the pair.
    case plan
    /// Writes and runs inside the Workspace, and asks to leave it. The baseline rung, so ungated
    /// tools do not pay a Permission round trip.
    case code
    /// No boundary, asks nothing.
    case auto
}

/// A Session's stance as Argo can state it: the rung, whether that rung is the NEAREST rather than
/// the exact one, and the CLI's own word for it. The mark is approximation and not a tier — an `≈`
/// reading is still DIRECT, and only `unknown` says the fact itself is not established.
public enum SessionModeReading: Equatable, Sendable {
    case exactly(SessionMode, cli: String)
    case nearly(SessionMode, cli: String)
    /// `cli` is absent where nothing was observed, and present where something was observed and had
    /// no honest rung — `claude`'s `dontAsk`, whose boundary is a pre-approved allowlist.
    case unknown(cli: String?)

    /// The rung to draw, and `nil` where there is none to draw.
    public var rung: SessionMode? {
        switch self {
        case let .exactly(rung, _), let .nearly(rung, _): rung
        case .unknown: nil
        }
    }

    /// Whether the rung is the nearest one rather than the CLI's own — what the `≈` marks.
    public var isApproximate: Bool {
        switch self {
        case .nearly: true
        case .exactly, .unknown: false
        }
    }

    /// The CLI's own value, verbatim and never reworded — it is what the approximation is
    /// measured against.
    public var cliValue: String? {
        switch self {
        case let .exactly(_, cli), let .nearly(_, cli): cli
        case let .unknown(cli): cli
        }
    }
}
