import ArgoEngine

/// What the composer asks of the Session, and what the seam says when the port refuses (#541,
/// #545, #687, ADR-0024).
///
/// Every act here ends in the draft, because the draft owns what a refusal leaves behind — which
/// is why none of them reports a result of its own.
extension SessionComposer {
    /// `send`, with the mentioned files NAMED where the CLI will not resolve an `@path` itself
    /// (#687). Wrapped once rather than at the three call sites, so a queued Turn and a retried one
    /// carry their files exactly as a straight send does.
    ///
    /// They ride the attachment path and never `draft.attachments`, which is what keeps a mention
    /// out of the tray: it stays a word in the line, and only the Turn that goes names the file.
    var sending: ComposerSend {
        let send = intents.send
        guard !composer.resolvesMentions else { return send }
        return { [composer, send] text, attachments in
            try send(text, ComposerMentions.attaching(
                attachments,
                for: text,
                within: composer.workspaceRoot,
            ))
        }
    }

    /// What a drop and a paste both end in — one act, so the two gestures cannot come to mean two
    /// different things. The capability is answered inside the draft rather than at each gesture,
    /// which is what lets a refused drop say why. `+` no longer reaches here at all: `AddMenu`'s
    /// own Files section is Argo's in-app Workspace tree, and a pick there becomes a mention in the
    /// text rather than an attachment (design decision 12, #689).
    func take(_ incoming: [SessionAttachment]) {
        draft.attach(incoming, canAttach: composer.canAttach)
    }

    /// Stop the Turn, and drop what was queued behind it (#541, design decision 4).
    ///
    /// The dropping happens HERE rather than off the Session going idle, and the order is what
    /// makes it work: the queue is emptied at the click, before the record catches up and the
    /// put the body watches for happens. Waiting for the status to turn would be waiting for the
    /// exact moment the queued follow-ups are released.
    ///
    /// The field itself is left alone — see `ComposerDraft.stopped(via:)`.
    func interrupt() {
        draft.stopped(via: intents.turn.stop)
    }

    /// Put one waiting follow-up into the running Turn, instead of waiting for it (#1238).
    ///
    /// In a `Task` for the reason `ask(for:)` is: the port's act is an interrupt, a pause and a
    /// Turn, and the click cannot wait on it.
    func steer(_ id: QueuedTurn.ID) {
        Task { await steering(id) }
    }

    /// The steer, and what each of its endings leaves. Awaitable and internal so a test can make
    /// the claim the `Task` above only fires and forgets.
    ///
    /// The interrupt is taken FIRST and synchronously, which is what makes the chip honest: by the
    /// time this awaits anything the Turn is already ending, and the chip says `SENDING` rather
    /// than going on claiming the follow-up is queued behind a Turn that is over.
    func steering(_ id: QueuedTurn.ID) async {
        guard let turn = draft.beginSteer(id, via: intents.turn.stop) else { return }
        do {
            try await intents.turn.steer(turn.text, turn.attachments)
            draft.steerLanded(id)
        } catch {
            draft.steerRefused(id, error)
        }
    }

    /// How long a landed Stop gets before its silence is worth saying (#1234).
    ///
    /// What is being waited on is the CLI writing a boundary and Argo reading it, which is the file
    /// watch plus a fold — the same road `TurnDelivery.patience` allows three seconds for, and one
    /// step longer. Generous on purpose, and in the direction that costs least: waiting too long
    /// delays a line nobody is depending on, while ending early posts a false one over a Stop that
    /// was landing all along.
    static let stopPatience = Duration.seconds(5)

    /// The wait after Stop, and what its ending leaves on the seam.
    ///
    /// Awaitable and internal for the reason `walk(to:)` is: the vessel only fires it, and a claim
    /// about what it decides has to be one a test can make without a wall-clock guess.
    ///
    /// What it reads afterwards is the DRAFT and never `composer`, which is this View's own value
    /// from the render that started the wait and says nothing about where the Session stands now.
    /// The draft is a `@Binding` into the store, so its count is the live one — and it is the same
    /// count any boundary clears, whoever made the Stop it stood for.
    func watchStop(patience: Duration = stopPatience) async {
        guard draft.unansweredStops > 0 else { return }
        try? await Task.sleep(for: patience)
        guard !Task.isCancelled else { return }
        draft.stopDidNotTake()
    }

    /// How long a put Turn gets to appear in the record before the queue stops waiting on it
    /// (#1337). `stopPatience`'s road and so its number: the CLI writing a boundary and Argo
    /// reading it, which is the file watch plus a fold.
    static let putPatience = stopPatience

    /// The wait on a put Turn reaching the record, so a claim cannot strand the queue (#1337).
    /// `turnStarted()` is the only other thing that spends one, and a Turn the record never shows
    /// running — one short enough that no reading caught it, one the CLI never heard (#682) —
    /// never fires it.
    ///
    /// It only spends the claim, and the release is made by the level: spending it is a movement
    /// in what `ComposerRelease.Awaiting` reads, so the next render asks against the status as it
    /// stands THEN rather than the one this View was built from.
    ///
    /// Awaitable and internal for the reason `watchStop(patience:)` is: the vessel only fires it,
    /// and a claim about what it decides has to be one a test can make without a wall-clock guess.
    func watchPut(patience: Duration = putPatience) async {
        guard draft.isAwaitingPutTurn else { return }
        try? await Task.sleep(for: patience)
        guard !Task.isCancelled, draft.isAwaitingPutTurn else { return }
        draft.putTurnDidNotAppear()
    }

    /// Ask the Session for a rung.
    ///
    /// In a `Task` because the picker's setter cannot wait: the walk takes a keystroke per rung
    /// with a gap behind each (#653), and the note lands when it resolves.
    func ask(for mode: SessionMode) {
        Task { await walk(to: mode) }
    }

    /// The walk, and what each of its endings leaves on the seam (#940). Awaitable and internal so
    /// a test can make the claim the `Task` above only fires and forgets.
    ///
    /// `modeBusy` is the one refusal the composer ANSWERS instead of repeating — but only while a
    /// Turn is running. Held against a Session the composer reads as idle, the rung would be
    /// waiting on a boundary that has already gone by.
    func walk(to mode: SessionMode) async {
        do {
            try await intents.settings.setMode(mode)
            draft.modeLanded(mode)
        } catch {
            guard (error as? SessionDriveError) == .modeBusy, composer.isRunning else {
                return draft.modeRefused(error)
            }
            draft.modeHeld(mode)
        }
    }

    /// One reading of whether the Turn is over, and what each of its two edges means.
    ///
    /// A Turn STARTING matters as much as one ending, and only since the steer: a steer puts a
    /// Turn the record has not caught up with, and until it does, `hasTurnEnded` reads `true` for
    /// the Turn the steer's own interrupt ended. Seeing one RUN again is what makes the status
    /// trustworthy for this Session again, so the claim is spent here and the boundary that
    /// follows is a real one (#1238).
    func turnRead(_ hasTurnEnded: Bool) {
        guard hasTurnEnded else { return draft.turnStarted() }
        turnEnded()
    }

    /// The Turn's boundary: the one EDGE in the release, and the only place the drop claim is
    /// spent. Everything else the release does is `release()` below, which is a level.
    ///
    /// It answers `hasTurnEnded` and never `!isRunning` (#1238): a Turn paused on a permission or
    /// on a question is not a Turn that ended, and dropping a queue there would destroy follow-ups
    /// the reader still means.
    ///
    /// What was waiting goes rung first, then the queue, for the reason `honour(_:)` states.
    ///
    /// Unless somebody STOPPED it, in which case the queue is dropped rather than released
    /// (#1189, design decision 4). Argo's own Stop already did that at the click; this is the same
    /// rule for an interrupt made anywhere else — an `ESC` at the dock terminal ends the Turn just
    /// as truly, and until the record was read as closing the Turn, no such Session ever came off
    /// `running` for this to fire on. The rung is NOT among what goes: it is about how the Session
    /// works next rather than about the Turn that was killed, and the boundary it waited for is
    /// the one the interrupt just made.
    func turnEnded() {
        guard composer.hasTurnEnded else { return }
        // Then, and inside that guard: a Turn merely PAUSED on a permission is one the Stop
        // genuinely has not taken yet, so the line stands until a real boundary answers it
        // (#1234, #1238). Ahead of the drop below, so a drop reported there is not the line this
        // takes down — the boundary that arrives IS the answer the wait gave up on.
        draft.stopTookAfterAll()
        if draft.mustDropQueue(afterInterrupt: composer.endedByInterrupt) {
            draft.dropQueue()
        }
        release()
    }

    /// Put what is waiting, if it may go now — `ComposerRelease` is the whole of the decision, and
    /// this is only the acts behind it.
    ///
    /// Asked at every movement in what the release reads rather than at the boundary alone
    /// (#1238), which is what makes a queue impossible to strand: a release the boundary could not
    /// make — because a walk held it, or because a refusal was standing, or because the boundary
    /// fired at a `permission` the Turn came back from — is simply made at the next reading.
    ///
    /// It is safe to ask as often as SwiftUI likes: every act below takes something out of what
    /// `ComposerRelease` reads, so a release that happens cannot happen twice, and the boundary's
    /// own once-per-Turn claim is spent in `turnEnded()` above rather than here.
    func release() {
        let release = ComposerRelease(composer, draft)
        if release.walks, let held = draft.beginModeWalk() {
            Task { await honour(held) }
            return
        }
        guard release.putsNext else { return }
        draft.putNext(via: sending)
    }

    /// The held rung and then the queue, and the ORDER is the whole of what this decides: a
    /// follow-up released ahead of the walk would run under a boundary its author had already
    /// moved, and it would put the Session back to running, which is what refuses the walk.
    func honour(_ held: SessionMode) async {
        await walk(to: held)
        // Through the level rather than straight to `putNext`, so the walk's own follow-through
        // obeys the same rule every other release does — a refusal standing here is still the
        // reader's to answer, and the walk clearing `isWalkingMode` is what opens this one.
        release()
    }

    /// Ask the Session for a model, and for an effort rung (#558).
    ///
    /// In a `Task` for the reason `ask(for:)` is: the picker's setter cannot wait, and the line
    /// reaches the CLI as a paste and a Return a pause apart. A refusal goes to the seam and
    /// NOTHING is held — unlike a rung, neither is queued for the Turn's boundary: the composer
    /// keeps showing what the CLI is still on, which is the true reading either way.
    func askForModel(_ modelID: String) {
        Task {
            do { try await intents.settings.setModel(modelID) } catch { draft.runFactRefused(error)
            }
        }
    }

    func askForEffort(_ effort: SessionEffort) {
        Task {
            do { try await intents.settings.setEffort(effort) } catch { draft.runFactRefused(error)
            }
        }
    }

    /// Mode, Model and Effort all back where a fresh Session starts (#558) — the one act the
    /// popover's reset makes, and the reason its sentence NAMES all three.
    ///
    /// Ordered Mode first, and each awaited: they are three separate lines at one prompt, and
    /// firing them together would interleave three pastes into one input batch. The first refusal
    /// stops the rest, because a reset that landed on two of three is not the state it named.
    func resetRunFacts() {
        Task {
            do {
                try await intents.settings.setMode(RunFacts.defaultMode)
                try await intents.settings.setModel(RunFactsModel.default.id)
                try await intents.settings.setEffort(RunFacts.defaultEffort)
            } catch {
                draft.runFactRefused(error)
            }
        }
    }

    /// Arriving at this Session, which is where a line the reader has already read comes down
    /// (#1183). Paired with `lostTurnArrived(_:)` below and safe in either order: what it reads is
    /// the Hub's own standing news, which neither pass moves.
    func arrived() {
        guard draft.isLostTurnStale(newsStanding: composer.lostTurn != nil) else { return }
        draft.say(nil)
    }

    /// News that the CLI never heard a Turn, taken in and spent in one act (#682, #1183).
    ///
    /// Neither half is conditional on the other (#1183). The draft decides what to do with the
    /// WORDS; the Hub is told the news landed either way — news left filed is re-announced by the
    /// `initial: true` pass every time the composer comes back on screen for that Session.
    func lostTurnArrived(_ text: String) {
        draft.turnLost(text, whileRunning: composer.isRunning)
        intents.lostTurnSeen()
    }

    /// The seam's remedy, which is not the same act as pressing send: what it puts back is
    /// whatever the refusal stopped, and after a refused put that is the queue, not the field.
    func retry() {
        draft.retry(via: sending)
    }
}
