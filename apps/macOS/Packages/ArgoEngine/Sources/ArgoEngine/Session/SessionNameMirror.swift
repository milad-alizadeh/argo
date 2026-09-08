/// Typing the name Argo draws at the Session's own prompt, so the phone stops reading a machine
/// slug (#1623).
///
/// #1494 typed a name on two triggers only — the rename dialog and a settled Ticket — so every row
/// wearing a prompt-derived name stayed nameless on Claude's own surfaces. This runs for every row
/// the roster draws a real name for, under one rule: **one typist, and it is Argo** (#1653).
/// Whatever the roster draws is what the CLI is told, whether or not the CLI already holds a title
/// of its own.
///
/// One exception, and it is a floor rather than a preference. A name Argo DERIVED must first say
/// something about the work: a transcript's UUID filename and a bare `/clear` are names only
/// because a row must have one, and typing one would make the CLI write it as a `custom-title` —
/// the top of the ladder, outranking every prompt and every summariser title that came after
/// (`SessionTitle.namesTheWork`). Argo reads that record back, so a placeholder typed once pins the
/// row at `.custom` on BOTH sides and poisons its own ladder. The floor is a TIMING rule: type
/// nothing until there is a real word to type, and let the retype below carry the name once there
/// is one.
///
/// The cost, stated plainly: Claude's summariser titles stop reaching rows Argo has words for.
/// That is the intent and not a side effect — an `ai-title` that disagrees with the roster is the
/// bug. Rows Argo cannot name are untouched and keep taking Claude's title.
///
/// An actor and not a value on the window: what went is remembered here, and remembering is the
/// difference between one busy moment costing a Session its name for the launch and costing it a
/// few seconds. Modelled on `TicketTitleResolver.carry`, which files what went for the same reason.
public actor SessionNameMirror {
    private let mirror: NameMirror
    /// The name each Session's CLI was last told, keyed by chain id — and the name a sweep is
    /// TYPING right now, filed before the keystroke rather than after it.
    ///
    /// Before, because the window fires an unstructured `Task` per roster change and this actor
    /// suspends in the middle of the keystroke: a second sweep interleaving there would find no
    /// memory for the row and type the same `/rename` again. A refusal takes the entry back off,
    /// which is what keeps the retry.
    private var mirrored: [String: String] = [:]

    public init(mirror: NameMirror = .silent) {
        self.mirror = mirror
    }

    /// Mirror every row whose name the CLI does not already hold.
    ///
    /// `draws` is what each row is CALLED, and `standings` is where its name stands on either side
    /// of the ladder (`Hub.nameStandings`). Taken as two maps rather than one joined value because
    /// they are two different windows' facts — one the cockpit's spelling of a name, one a reading
    /// off the transcript — and joining them at the caller would put the join in the app target
    /// where no suite can reach it (ADR-0022).
    ///
    /// So the join is HERE, and it is checked rather than assumed: each half names the roster title
    /// it was read at, and a draw whose standing was read at other words is stale (#1695). Not the
    /// whole of that fix — a `custom-title` repeating the words already on the row raises the
    /// standing WITHOUT moving them, so the two halves agree while the floor is still wrong.
    /// `SessionTitle.standing` is what refuses that one.
    public func carry(
        _ draws: [String: SessionNameDraw],
        against standings: [String: SessionNameStanding],
    ) async {
        for (sessionID, draw) in draws {
            await carry(draw, to: sessionID, standing: standings[sessionID])
        }
    }

    /// The rule, for one row. Every refusal is silence: a mirror that did not go is not news,
    /// because the Argo-side name is already on the row.
    private func carry(
        _ draw: SessionNameDraw,
        to sessionID: String,
        standing: SessionNameStanding?,
    ) async {
        // A row nothing could state a standing for — a row the draw's own pass held and the
        // standings' pass has retired. The honest answer is the quieter one (`CONTEXT.md` L2 ·
        // degrade-down): say nothing rather than type at a Session Argo cannot say a thing about.
        guard let standing else { return }
        // Already told this CLI these words, or a sweep is telling it right now. The sweep runs
        // whenever a name or a Session's readiness moves, and one mirror per sweep would retype
        // `/rename` at a Session that has been sitting on the right name for hours.
        guard mirrored[sessionID] != draw.name else { return }
        // The CLI is ALREADY on these words — which is what a launch after a successful mirror
        // reads, since nothing carried the memory above across it. Filed rather than typed, so
        // this is asked once per launch and not once per sweep.
        guard standing.cliTitle != draw.name else {
            mirrored[sessionID] = draw.name
            return
        }
        // A name of Argo's OWN making has to say something about the work first — see the type's
        // own note for why a placeholder typed once can never be taken back.
        //
        // Asked of the SAME pass the words came from, which is the join #1695 was about. The two
        // are read at different moments: the draw is captured in an `onChange` payload and the
        // standing is read later, inside this actor's hop (`Hub.mirrorNames`). A draw taken while
        // the row still wore its transcript's filename, held against a standing read after the
        // first prompt folded, cleared this floor with a UUID as the words. Silence when they
        // disagree — the pass the draw came from is gone, and the sweep the moving title fires
        // brings both halves back together.
        //
        // Under the derived draws alone, because they are the only ones that read `namesTheWork`:
        // a Ticket's sentence and a person's rename have no join here to be stale.
        guard !draw.drawsDerivedTitle
            || (draw.rosterTitle == standing.rosterTitle && standing.namesTheWork)
        else { return }
        // There is NO second gate here, and the one that stood in this place is why the two
        // surfaces disagreed (#1653). It read `draw.isReaderNamed || standing.cliTitle == nil` —
        // Claude wins where Claude has a name — and it yielded to a title Argo had usually
        // written itself: the first mirror of a launch types `/implement 1665` as a
        // `custom-title`, and every later sweep then found a non-nil `cliTitle` and refused the
        // Ticket's real words for the life of the Session. Measured on #1665: five title records,
        // all five the placeholder, while the row drew the Ticket's sentence.
        //
        // It yielded nothing worth keeping either. Where a row draws its DERIVED name,
        // `SessionTitle`'s ladder already puts `summarised` and `custom` above `prompt`, so Argo
        // is drawing the CLI's own title and the two agree with or without the gate. It only ever
        // changed the answer on rows where Argo has BETTER words than Claude does — which is the
        // bug, stated as a rule.
        //
        // So: one typist, and it is Argo. `cliTitle` is still read, three lines up, for the
        // "already on these words" check that keeps a sweep from retyping once per pass; what is
        // gone is its use as a veto.
        //
        // Reserved BEFORE the keystroke, and taken back if the prompt refused it. A `codex`
        // Session refuses here through its own driver (`titleUnsupported`): it has no `/rename`
        // and no title of its own, so it keeps the name Argo derives and nothing stays filed. No
        // gate of ours says so — the port that cannot do it is the honest place.
        mirrored[sessionID] = draw.name
        guard await mirror.carry(draw.name, sessionID) else {
            mirrored[sessionID] = nil
            return
        }
    }
}
