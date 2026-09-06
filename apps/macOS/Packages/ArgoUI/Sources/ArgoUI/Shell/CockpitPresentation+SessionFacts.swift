import ArgoEngine

/// The other five readings' facts, read off the values that hold them (#1503) — the chain's are in
/// `CockpitPresentation+SessionFacts+Chain.swift`, on the same reasoning and under the same
/// file cap.
///
/// Each name here is the name of the fact it reads. Where the two differ, a `renamed:` line beside
/// it says why — the one place a swap between two same-typed facts would hide, since nothing checks
/// this any more (#1532 deleted the gate that did). Read those lines when reviewing this file.
public extension CockpitPresentation.Session {
    /// The folder the Session is running in. Absent for a Session Argo read no path for.
    ///
    /// renamed: workspaceLocation <- location — `location` alone would not say WHICH; under `Work`
    /// it is beside the checkout that says so, and out here it is not.
    var workspaceLocation: String? {
        work.location
    }

    /// Absent for a Session with no checkout at all, rather than an empty Workspace: a Workspace
    /// whose every field is `nil` is a claim that one exists.
    var workspace: Workspace? {
        work.workspace
    }

    /// Which Ticket this Session is on, and — where it is on none — which of the two ways
    /// that is true (#894). A reading rather than an optional, so a Session nobody could have
    /// read a link for is never drawn as one nothing named a Ticket for.
    var ticket: TicketLinkReading {
        work.ticket
    }

    /// The code host's pull request for this Session's branch (`CONTEXT.md` L1 · Delivery),
    /// and `nil` for a branch with none open. DERIVED, off `Readings.deliveries` rather than
    /// off anything the Hub reports.
    var pullRequest: DeliveryPullRequest? {
        work.delivery.pullRequest
    }

    /// Whether this Session's companion claim to be ready for a pull request still draws
    /// (`CONTEXT.md` L1 · Delivery, #1335) — already resolved against `pullRequest` above, so
    /// no surface below the shell re-asks whether an open pull request makes the claim stale.
    var readyToShip: Bool {
        work.delivery.readyToShip
    }

    /// What the Session has spent across its whole life, in tokens — every reported spend
    /// summed, both grains (`CONTEXT.md` L3), cache excluded. The opposite reading from
    /// `context` below, which is only what it is holding now.
    var spentTokens: Int? {
        spend.spentTokens
    }

    /// The cache half of the same life — read and re-read once per request, so it dwarfs
    /// `spentTokens` by the turn count. Split out so neither figure inflates the other.
    var cachedTokens: Int? {
        spend.cachedTokens
    }

    /// What its subagents spent, of that total. **Absent, never zero**, where nothing
    /// reported any — which is every CLI in use today, and why the header drops the fact
    /// off its line rather than printing a zero that would claim no subagent ran.
    var subagentTokens: Int? {
        spend.subagentTokens
    }

    /// How full the Session's context is right now — the latest reading its records carry,
    /// DERIVED. `unread` where no record has reported a spend at all, which the header draws
    /// as NOTHING; `unreadable` is the one the header words `unknown` (#1249).
    var context: ContextReading {
        spend.context
    }

    /// The Session's standing autonomy stance, as Argo can state it (ADR-0025) — the rung,
    /// whether it is the nearest rather than the exact one, and the CLI's own word for it.
    /// `unknown` covers both the Session nobody has read a stance off and the one whose
    /// boundary Argo cannot see.
    var mode: SessionModeReading {
        autonomy.mode
    }

    /// The rung Argo asked for and the CLI then contradicted, and `nil` for every ordinary
    /// reading (#629). `mode` above has already snapped to the real rung, so this is the only
    /// thing that can say why the control moved without the user touching it.
    var modeDidNotTake: SessionMode? {
        autonomy.modeDidNotTake
    }

    /// The Permission the Session's agent is blocked on, verbatim from the engine — DIRECT,
    /// because Argo holds the blocked hook itself. Absent for every Session that is not
    /// waiting on one, which is what returns the composer to its slot.
    var permission: PermissionRequest? {
        autonomy.blocked.permission
    }

    /// The question the Session's agent is blocked on (#712), verbatim from the engine —
    /// DIRECT, on the same ground the Permission above is. Absent for every Session that is not
    /// waiting on one, which is what returns the feed's ask row to being a reading.
    var ask: SessionAsk? {
        autonomy.blocked.ask
    }

    /// The question the Session's agent raised over the companion plugin and nobody has
    /// answered (#1205) — CONVENTION, and a reading rather than a handle: Argo answered the
    /// call the moment it arrived, so there is nothing here to answer down. Beside `ask` and
    /// never instead of it; the feed draws the two apart.
    var companionAsk: CompanionAsk? {
        autonomy.blocked.companionAsk
    }

    /// The tools this Session has stopped asking about (#572), verbatim from the engine and in
    /// the order they were granted. Empty for a Session that has granted none, which is every
    /// Session until somebody says otherwise.
    var standingAllows: [StandingAllow] {
        autonomy.standingAllows
    }

    /// The Permissions this Session's gate refused when nobody answered them (#573), verbatim
    /// from the engine and in the order they expired. Empty for every Session whose prompts
    /// were all answered, cancelled, or are still waiting — which is every Session in practice,
    /// since the gate waits a day.
    var expiredPermissions: [PermissionExpiry] {
        autonomy.expiredPermissions
    }

    /// Whether the user cleared this Session off the roster. Argo's own fact and not a
    /// reading of anything (`CONTEXT.md` "Storage & ownership"): nothing observed sets it,
    /// which is why new activity on an archived Session leaves it archived (#502, story 16)
    /// and why a merged branch does not clear its Session (story 14).
    var isArchived: Bool {
        annotations.isArchived
    }

    /// The name the user gave this Session, beside — never instead of — the `title` on the value
    /// itself: the derived one has to survive being overridden, or the Reset in the rename dialog
    /// would have nothing to go back to (#502, story 20). Argo's own fact, and absent for a
    /// Session nobody renamed. Which of the two the surfaces DRAW is `SessionTitle`'s.
    var explicitName: String? {
        annotations.explicitName
    }

    /// The Ticket the user attached this Session to by hand (#1092), and `nil` for one they
    /// never did — which is every Session whose link Argo derived off a branch. Argo's own
    /// fact, on `explicitName`'s ground, and the only thing that says whether the reader has a
    /// decision here to take back.
    var pinnedTicket: Int? {
        annotations.pinnedTicket
    }

    /// Everything the transcript said, in order — the stream itself, undigested. What the feed
    /// builds its rows from, and the one fact here that is a whole sequence rather than a reading.
    var events: [TranscriptEvent] {
        transcript.stream.events
    }

    /// The last Turn typed at this Session that the CLI never heard, verbatim (#682), and `nil` for
    /// every Turn that arrived. The composer cleared when the keystrokes were written, so this is
    /// the only thing that can put the words back.
    var lostTurn: String? {
        transcript.lostTurn
    }

    /// The Turn Argo typed that nothing has answered yet (#1179, #1278) — the engine's own
    /// reading, carried through unchanged. Its words are what the feed draws in the second before
    /// the record lands.
    var submittedTurn: String? {
        transcript.submittedTurn
    }

    /// Whether there is such a Turn. It outranks the status word wherever the two disagree, which
    /// is what the composer asks it for.
    var hasUnansweredTurn: Bool {
        transcript.hasUnansweredTurn
    }

    /// What a backgrounded delegation is holding open in this Session's record (#1267) — the
    /// engine's own reading, carried through unchanged. What the composer asks it is whether the
    /// open Turn the status word was read off is the PARENT's work or a child's.
    var delegationHold: DelegationHold {
        transcript.delegationHold
    }
}
