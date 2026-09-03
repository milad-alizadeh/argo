/// How hard the Session's CLI is told to think — one of the CLI's own two knobs, and never one of
/// Argo's (#558). It sits beside Model on the composer and pointedly NOT beside Mode: Mode is
/// Argo's standing autonomy stance, and a scale that changed how often you are asked would be a
/// different control (`CONTEXT.md` L4 · Autonomy).
///
/// Ordered rather than a set of equals, which is what makes the control a scale and not a list.
/// The order here IS the scale's, so `allCases` is what the segments are drawn from.
public enum SessionEffort: String, CaseIterable, Hashable, Sendable {
    case low
    case medium
    case high
    case xhigh
    case max
}

/// A Session's effort as Argo can state it: the rung, or the CLI's own word where that word is on
/// no rung Argo knows.
///
/// The same shape as `SessionModeReading` minus the `≈` arm, and deliberately: effort has no
/// nearest-rung reading to give. The scale's words come from the CLI verbatim, so a word off the
/// ladder is a word this Argo has not heard of rather than a value sitting between two it has —
/// approximating it would put a tick on a rung nobody picked (`CONTEXT.md` degrade-down).
public enum SessionEffortReading: Equatable, Sendable {
    case exactly(SessionEffort, cli: String)
    /// `cli` is absent where nothing was observed, and present where a word was observed that is on
    /// no rung — a CLI that grew a sixth level this Argo predates.
    case unknown(cli: String?)

    /// The rung to tick, and `nil` wherever a tick would be a lie.
    public var rung: SessionEffort? {
        switch self {
        case let .exactly(rung, _): rung
        case .unknown: nil
        }
    }

    /// The CLI's own value, verbatim and never reworded.
    public var cliValue: String? {
        switch self {
        case let .exactly(_, cli): cli
        case let .unknown(cli): cli
        }
    }
}

/// The scale in `claude`'s own vocabulary — `--effort` on the way in, the value its records report
/// on the way out.
///
/// Verified against `claude` 2.1.257 on 2026-09-03: `--effort <level>` documents five levels,
/// `low, medium, high, xhigh, max`, and `/effort <level>` sets the same five mid-session. The
/// approved design drew four; the fifth is why `cockpit-session-composer.md` carries an
/// amended-in-build note against #558.
public enum ClaudeEffort {
    /// What Argo types to put a Session on this rung. The CLI's own words are the enum's raw
    /// values, so there is one spelling and no table to keep in step with the ladder.
    public static func value(for effort: SessionEffort) -> String {
        effort.rawValue
    }

    /// What an observed value means on the scale. A word off the ladder is `unknown` carrying that
    /// word — the composer states it verbatim and ticks no segment.
    public static func reading(of observed: String) -> SessionEffortReading {
        guard let rung = SessionEffort(rawValue: observed) else { return .unknown(cli: observed) }
        return .exactly(rung, cli: observed)
    }
}
