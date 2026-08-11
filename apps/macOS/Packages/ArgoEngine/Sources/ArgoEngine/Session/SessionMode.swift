/// The Session's standing autonomy stance — a four-rung ladder whose rungs are BOUNDARIES rather
/// than prompt frequencies: inside a rung the agent acts, at its edge a Permission fires
/// (`CONTEXT.md` L2 · Autonomy, ADR-0025).
///
/// The boundary reading is the one both CLIs can express: Codex substitutes a sandbox for asking
/// where Claude substitutes asking for a sandbox, so a frequency ladder would have rungs one of
/// them could not reach.
public enum SessionMode: CaseIterable, Equatable, Sendable {
    /// No writes are possible.
    case readOnly
    /// Read Only's boundary carrying a deliverable: the agent proposes, then hands off. Shares
    /// `readOnly`'s permission level and differs by INTENT — the ladder's one deliberate pair, so a
    /// future edit must not collapse it.
    case plan
    /// Writes and runs inside the Workspace, and asks to leave it. The baseline rung, so ungated
    /// tools do not pay a Permission round trip.
    case code
    /// No boundary, asks nothing.
    case auto
}

/// A Session's stance as Argo can state it: the rung, whether that rung is the NEAREST rather than
/// the exact one, and the CLI's own word for it.
///
/// The mark is approximation and not a tier — Argo knows the fact exactly and only its own
/// vocabulary is coarser, so an `≈` reading stays as honest as an exact one. `unknown` is kept for
/// the case where the fact itself is not established: a stance nobody has observed, or one whose
/// boundary Argo cannot see at all.
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

    /// The CLI's own value, verbatim and never reworded: it is what the approximation is measured
    /// against, and what a reader hovers to see.
    public var cliValue: String? {
        switch self {
        case let .exactly(_, cli), let .nearly(_, cli): cli
        case let .unknown(cli): cli
        }
    }
}
