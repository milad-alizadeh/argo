/// What a Session is doing, rolled up (CONTEXT.md, "Session status"). Always DERIVED, never
/// stored, and carrying its own `unknown` so a status that cannot be established honestly has
/// somewhere to go (ADR-0008's degrade-down rule).
public enum SessionStatus: Sendable, Equatable, CaseIterable {
    /// Argo started the process and it has not spoken yet. DIRECT, managed only, and unreachable
    /// from `read(_:)` — no record exists to read it off (`HubSession.statusReading`, #587).
    case starting
    /// A Turn is in progress.
    case running
    /// Blocked on an agent `request_permission` prompt. DIRECT, managed only.
    case permission
    /// Blocked on a structured `AskUserQuestion`.
    case asking
    /// A Turn ended `end_turn`, or there is no live signal. Includes an agent's free-form question,
    /// which is indistinguishable from idle in the record.
    case idle
    /// A Turn ended `max_tokens`, `max_turn_requests` or `refusal`.
    case stopped
    /// The Session terminated.
    case ended
    /// Nothing establishes a status. Not a state the Session is in — a state we cannot claim.
    case unknown
}

public extension SessionStatus {
    /// The Session's status, honesty-gated by posture and corroborated by liveness.
    ///
    /// DERIVED for every posture, managed included: Argo owns the PTY but not the link from it to a
    /// transcript file, which is a working directory plus a time window and not a unique key. A
    /// Turn Argo itself submitted needs no such link and is read above this, at DIRECT
    /// (`HubSession.statusReading`, #1048) — every reading that reaches HERE is DERIVED.
    ///
    /// `permission` is unreachable here by construction — it belongs to the channels Argo owns (the
    /// permission gate, then the companion's report).
    static func read(_ signals: SessionSignals) -> SessionStatusReading {
        SessionStatusReading(tier: .derived, status: status(signals))
    }

    /// Liveness is what may claim a Session is working; the record is what says what it was doing.
    ///
    /// A Session with no Turn in it yet leaves liveness UNTOUCHED: the process match plus recency
    /// IS the reading, and only the refinements a parsed record would add go absent.
    private static func status(_ signals: SessionSignals) -> SessionStatus {
        guard signals.liveness == .live else { return quiet(signals) }
        if signals.pendingAsk, signals.turnOpen {
            return .asking
        }
        return signals.turnOpen || !signals.hasTurns ? .running : boundary(signals)
    }

    /// A Session nothing corroborates as working. `ended` needs a process exit Argo WITNESSED,
    /// which is exactly the `orphaned` posture; everything else falls back to the last boundary.
    private static func quiet(_ signals: SessionSignals) -> SessionStatus {
        signals.provenance == .orphaned ? .ended : boundary(signals)
    }

    /// What the last Turn boundary says on its own.
    ///
    /// `stopped` is managed-only: reading a wall the agent hit AS a wall is a claim about a Session
    /// Argo owns, and it collapses to `idle` the moment the same Session is observed from outside.
    private static func boundary(_ signals: SessionSignals) -> SessionStatus {
        // A Turn opened since the last boundary, so that boundary is the previous Turn's and says
        // nothing about this one. Uncorroborated, an open Turn is quiet — never `running`.
        guard !signals.turnOpen else { return .idle }
        return switch signals.lastStop {
        case .endTurn, .cancelled: .idle
        case .maxTokens, .maxTurnRequests, .refusal:
            signals.provenance == .managed ? .stopped : .idle
        case .unknown, .none: .unknown
        }
    }
}

public extension SessionStatus {
    /// Whether the CLI's own prompt is free to take a line somebody types at it (#1217).
    ///
    /// `running` is the obvious one: the CLI queues a line typed mid-Turn as the NEXT prompt rather
    /// than running it. The other two matter more. A `permission` or an `asking` Session has its
    /// keyboard held by a DIALOG, so a `/model` line typed then is eaten by that dialog — and the
    /// Return behind it answers whatever the dialog had highlighted. That is worse than a line
    /// going nowhere, which is why the three answer together.
    ///
    /// `starting` is deliberately NOT among them. Argo has written the argv and has not heard the
    /// child yet; the prompt is on its way rather than held by something else, and refusing there
    /// would refuse the one moment a Session is being set up in.
    var takesTypedLine: Bool {
        switch self {
        case .running, .permission, .asking: false
        case .starting, .idle, .stopped, .ended, .unknown: true
        }
    }
}
