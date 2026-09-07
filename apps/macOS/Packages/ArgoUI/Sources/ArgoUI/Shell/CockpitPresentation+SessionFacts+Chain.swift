import ArgoEngine

/// The chain's facts, read off the one value that holds them (#1503) — the shape every surface
/// below the shell already asks for, and the reason none of them had to change when the Session
/// stopped copying `Chain` onto a second set of fields.
///
/// Each name here is the name of the fact it reads. Where the two differ, a `renamed:` line beside
/// it says why — the one place a swap between two same-typed facts would hide, since nothing checks
/// this any more (#1532 deleted the gate that did). Read those lines when reviewing this file.
public extension CockpitPresentation.Session {
    /// Which agent program is running (`CONTEXT.md` L2). Absent where Argo cannot say, which
    /// is every Session read from a record whose CLI it did not recognise.
    var cli: AgentCLI? {
        chain.program.cli
    }

    /// The model the CLI is running under, verbatim and unread — what the composer states and
    /// what the header's line names, and absent for a record that reported none.
    var model: String? {
        chain.program.model
    }

    /// The CLI's own word for the effort level, verbatim and unread (#558) — `ClaudeEffort`
    /// says what it means on the scale, and the composer states whatever this is either way.
    var effort: String? {
        chain.program.effort
    }

    /// How this Session's process was started (`CONTEXT.md` L2 · Entry) — DERIVED, and
    /// `interactive` wherever Argo read no word it recognised.
    var entry: SessionEntry {
        chain.program.entry
    }

    /// When this Session first did anything, in milliseconds since the epoch — the oldest
    /// moment its records report. With `lastSeenAtMs` beside it, the pair IS the Session's
    /// wall-clock span; alone, neither of them is a duration.
    var startedAtMs: Int? {
        chain.span.startedAtMs
    }

    /// When this Session was last seen to run, in milliseconds since the epoch. The Hub's own
    /// sort key rather than a second reading of it. Absent where neither the records nor the
    /// file behind them could say — a gap, never a moment standing in for one.
    var lastSeenAtMs: Int? {
        chain.span.lastSeenAtMs
    }

    /// When the wait for this Session's first byte ran out with its process still up (#1245) —
    /// DIRECT, and the only thing on this value that can say why a row Argo started has neither
    /// spoken nor gone. Absent for every Session Argo did not start, and for every one that came
    /// up and printed something.
    ///
    /// renamed: startedQuietlyAtMs <- quietAtMs — the fact is `Startup.quietAtMs` under the wait
    /// it belongs to, and the engine's own `startedQuietlyAtMs` out here beside the other moments,
    /// where nothing named `Startup` is in scope to say WHICH wait went quiet (#1328).
    var startedQuietlyAtMs: Int? {
        chain.span.startup.quietAtMs
    }

    /// The waits Argo held here that have ENDED (#1323), oldest first — see
    /// `SessionWaitSettled`. Each drops into the reading as one settled row. Empty for every
    /// Session Argo did not start, which is what keeps the plinth DIRECT.
    var settledWaits: [SessionWaitSettled] {
        chain.span.settledWaits
    }

    /// Whether this Session is continuing a chain rather than opening one (#1328) — DIRECT, off
    /// the engine's own `resuming`. `false` for every Session Argo did not start, which is what
    /// keeps the plinth off a resume nobody performed.
    var resuming: Bool {
        chain.span.startup.resuming
    }

    /// The Session this one handed its work to, as the id of the row that now carries it
    /// (`CONTEXT.md` L2 — the resume chain a handoff makes across two Sessions rather than
    /// within one). Absent for every Session that has not handed off, which is nearly all of them.
    var handedOffTo: String? {
        chain.handoff.handedOffTo
    }

    /// Whether Argo is running `/handoff` here right now (#1327) — DIRECT, off the engine's own
    /// `handingOff`. What the header button and the plinth both read, so neither carries the
    /// fact on its own (`SessionHandoffButton`).
    var handingOff: Bool {
        chain.handoff.handingOff
    }

    /// The handoffs Argo attempted here that did NOT land (#1327), oldest first — each drops a
    /// failed row into the reading. Empty for every Session that never tried one, or whose only
    /// attempt landed: a landed handoff leaves nothing here, because `handedOffTo` above is its
    /// record.
    var handoffFailures: [SessionWaitSettled] {
        chain.handoff.handoffFailures
    }

    /// Whether the companion channel this Session's CONVENTION-tier facts arrive over is up
    /// (#493). `notApplicable` draws NOTHING rather than a negative claim.
    var companionChannel: CompanionLiveness {
        chain.companionChannel
    }
}
