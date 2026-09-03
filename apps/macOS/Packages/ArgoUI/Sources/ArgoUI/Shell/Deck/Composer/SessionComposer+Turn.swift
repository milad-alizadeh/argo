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

    /// Stop the Turn, and empty the composer behind it (#541, ADR-0024).
    ///
    /// The clearing happens HERE rather than off the Session going idle, and the order is what
    /// makes it work: the queue is emptied at the click, before the record catches up and the
    /// flush the body watches for fires. Waiting for the status to turn would be waiting for the
    /// exact moment the queued follow-ups are released.
    func interrupt() {
        draft.stopped(via: intents.stop)
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

    /// The Turn has ended, so what was waiting on it goes — the rung first, then the queue, for
    /// the reason `honour(_:)` states.
    func turnEnded() {
        guard let held = draft.beginModeWalk() else { return draft.flush(via: sending) }
        Task { await honour(held) }
    }

    /// The held rung and then the queue, and the ORDER is the whole of what this decides: a
    /// follow-up released ahead of the walk would run under a boundary its author had already
    /// moved, and it would put the Session back to running, which is what refuses the walk.
    func honour(_ held: SessionMode) async {
        await walk(to: held)
        draft.flush(via: sending)
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
                try await intents.settings.setMode(.code)
                try await intents.settings.setModel(RunFactsModel.default.id)
                try await intents.settings.setEffort(RunFacts.defaultEffort)
            } catch {
                draft.runFactRefused(error)
            }
        }
    }

    /// The seam's remedy, which is not the same act as pressing send: what it puts back is
    /// whatever the refusal stopped, and after a refused flush that is the queue, not the field.
    func retry() {
        draft.retry(via: sending)
    }
}
