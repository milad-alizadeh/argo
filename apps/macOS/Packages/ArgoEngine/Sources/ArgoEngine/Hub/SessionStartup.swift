import Foundation

/// Where a spawned row is in the wait for its CLI's first byte (#587, #1245).
///
/// One value rather than two flags, because the states exclude each other by construction: a row
/// cannot be both still starting and past the limit on that wait, and two Bools would let it say
/// so. `notWaiting` covers every Session Argo did not start and every spawn that has spoken or
/// gone — a record existing at all is proof the CLI spoke.
///
/// DIRECT throughout: Argo owns the descriptor nothing came out of, and owns the clock that
/// decides the silence has gone on long enough.
enum SessionStartup: Sendable, Equatable {
    /// Nothing is being waited for here.
    case notWaiting
    /// Argo started the process and has not heard it yet — what the row reads `starting` off.
    case awaitingFirstOutput
    /// The wait ran out with the process still up: it started, and printed nothing. Carries WHEN,
    /// so a surface can say how long the silence has run rather than only that it has.
    case quiet(atMs: Int)
}

extension SessionStartup {
    /// Whether Argo has heard nothing at all off this row's PTY. True on BOTH sides of the limit:
    /// the limit says how long the silence has run, never that it ended. What #1048's rule is read
    /// off — a CLI Argo has not heard cannot be shown to have heard a Turn either.
    var heardNothing: Bool {
        self != .notWaiting
    }

    /// When the wait ran out on a process that was still up, and `nil` for every other state.
    var quietAtMs: Int? {
        guard case let .quiet(atMs) = self else { return nil }
        return atMs
    }

    /// A spawn's own place in that wait. An exit outranks the whole of it — a spawn that died
    /// having never spoken reads `ended`, not `starting` and not quiet.
    init(_ spawn: AgentSpawn) {
        guard spawn.startup.exit == nil, spawn.startup.firstOutputAtMs == nil else {
            self = .notWaiting
            return
        }
        self = spawn.startup.quietAtMs.map(SessionStartup.quiet) ?? .awaitingFirstOutput
    }
}
