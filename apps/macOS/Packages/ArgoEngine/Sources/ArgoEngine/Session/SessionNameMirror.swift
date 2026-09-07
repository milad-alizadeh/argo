/// One row's name as the cockpit DRAWS it, and where those words came from (#1623).
///
/// The words rather than the standing they were won at: `SessionTitle` decides which of a Session's
/// names a row wears, and by the time the mirror runs that contest is over. What it still has to
/// know is where they CAME from — a name Argo derived is the one case that has to clear a floor
/// before it may be typed at all.
///
/// It no longer asks whether the READER chose them (#1653). That fact existed to except a person's
/// rename from a gate that yielded to any CLI title, and with the gate gone there is nothing for
/// the exception to except: the roster's words are typed whoever wrote them.
public struct SessionNameDraw: Sendable, Equatable, Hashable {
    /// The name on the row, spelled exactly as the roster spells it — Argo's own edits included,
    /// which is deliberate: the two surfaces agreeing is the whole point, and a phone showing the
    /// unedited words would disagree with the desk again (`ArgoUI.SessionTitle.spelled`).
    public let name: String
    /// Whether the row fell all the way through the naming chain to its OWN summary — so these
    /// words are Argo's reading of the conversation rather than a Ticket's or a person's
    /// (`ArgoUI.SessionTitle.Naming.drawsDerivedTitle`). Only these are held to the floor:
    /// a Ticket's sentence says what the work is whatever the transcript has managed to say.
    public let drawsDerivedTitle: Bool
    /// Whether a slash command typed at this Session would be RUN right now. Not a gate — the
    /// driver refuses a held keyboard itself — but the fact whose CHANGE brings the sweep back,
    /// which is how a refused `/rename` is retried rather than lost.
    ///
    /// It has to be the reading the DRIVER refuses on (`SessionStatus.takesSlashCommand`) and not
    /// the wider one about a prompt: a map keyed on a fact that stands still across
    /// `.permission -> .running` sleeps through the one transition that frees a blocked rename
    /// (#1662).
    public let takesSlashCommand: Bool

    public init(
        name: String,
        drawsDerivedTitle: Bool,
        takesSlashCommand: Bool,
    ) {
        self.name = name
        self.drawsDerivedTitle = drawsDerivedTitle
        self.takesSlashCommand = takesSlashCommand
    }
}

/// Where one Session's name stands on both sides of the ladder, read off the Hub (#1623).
///
/// Two facts and not one, because the mirror asks two different questions: whether Claude already
/// has a name for this Session, and whether the name ARGO holds is one worth putting at a prompt.
public struct SessionNameStanding: Sendable, Equatable {
    /// The CLI's own title, and `nil` where it holds none — see `SessionTitle.cliTitle`.
    public let cliTitle: String?
    /// Whether the name Argo derived says anything about the work — see
    /// `SessionTitle.namesTheWork`.
    public let namesTheWork: Bool

    public init(cliTitle: String?, namesTheWork: Bool) {
        self.cliTitle = cliTitle
        self.namesTheWork = namesTheWork
    }
}

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
    /// Both readings come from the same roster pass: `draws` is what each row is CALLED, and
    /// `standings` is where its name stands on either side of the ladder (`Hub.nameStandings`).
    /// Taken as two maps rather than one joined value because they are two different windows'
    /// facts — one the cockpit's spelling of a name, one a reading off the transcript — and joining
    /// them at the caller would put the join in the app target where no suite can reach it
    /// (ADR-0022).
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
        // A row nothing could state a standing for. Both maps are built off the same roster pass,
        // so nothing should produce one — and the honest answer to it is the quieter one anyway
        // (`CONTEXT.md` L2 · degrade-down): say nothing rather than type at a Session Argo cannot
        // say a thing about.
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
        guard !draw.drawsDerivedTitle || standing.namesTheWork else { return }
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
