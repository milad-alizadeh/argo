import ArgoEngine

/// What the composer holds about the RUNG the Session is on, and about the two knobs beside it
/// (#545, #558, #653, #940, #1329).
///
/// Its own file for the reason `ComposerDraft+Attachments.swift` is one, and split off by #1189
/// when the interrupt's own rules pushed the type past its body ceiling. The seam is real rather
/// than arithmetic: everything here is about how the Session WORKS NEXT, where the rest of the
/// draft is about the words somebody typed — which is exactly why a held rung outlives the
/// interrupt that drops the queue.
extension ComposerDraft {
    /// The port's reason a rung did not land (#545), on the seam as a notice rather than a
    /// refusal: no words are at risk, so there is nothing for the seam's Retry to put back.
    ///
    /// Given the outcome rather than the act, because the walk is `async` (#653) and a `mutating`
    /// method cannot hold a draft open across the wait.
    mutating func modeRefused(_ error: any Error) {
        heldMode = nil
        isWalkingMode = false
        say(ComposerSeamLine(error))
    }

    /// The rung landed. It takes back only the sentence IT put up — a notice about something else,
    /// the Turn the reader stopped or the one the CLI never heard, is not this act's to erase.
    mutating func modeLanded(_ mode: SessionMode) {
        heldMode = nil
        isWalkingMode = false
        guard notice == Self.held(mode) else { return }
        say(nil)
    }

    /// A rung the port refused because a Turn is running (#653, #940): kept for the boundary
    /// rather than dropped, and said on the seam.
    mutating func modeHeld(_ mode: SessionMode) {
        heldMode = mode
        isWalkingMode = false
        say(ComposerSeamLine(Self.held(mode)))
    }

    /// The rung to walk now the Turn has ended, and `nil` where there is none or a walk is already
    /// under way. MARKED rather than taken: the picker draws the held rung until the walk lands,
    /// and a rung taken twice would be walked twice from a stance the first walk had left (#653).
    mutating func beginModeWalk() -> SessionMode? {
        guard let heldMode, !isWalkingMode else { return nil }
        isWalkingMode = true
        return heldMode
    }

    /// What the seam says about a rung Argo is holding: the port's own refusal first, verbatim,
    /// then what Argo did with the intent. Both halves, because a reader who picked a rung needs
    /// to know it was refused AND that it was not dropped.
    package static func held(_ mode: SessionMode) -> String {
        "\(SessionDriveError.modeBusy.detail) — \(mode.label) is held until this Turn ends"
    }

    // MARK: Model and Effort (#1329)
    //
    // The same four acts `heldMode` answers to, kept apart because the two knobs land as two
    // separate lines at the prompt rather than one walk — `beginRunFactsWalk()` marks both at
    // once, and `SessionComposer.honourRunFacts(_:)` awaits each in turn.

    /// The port's reason a Model did not land, refused for anything OTHER than the busy prompt: a
    /// held Model is not this failure's to keep, on `modeRefused`'s own rule.
    mutating func modelRefused(_ error: any Error) {
        heldModel = nil
        isWalkingRunFacts = false
        say(ComposerSeamLine(error))
    }

    /// The port's reason an Effort rung did not land, on the same rule `modelRefused` states.
    mutating func effortRefused(_ error: any Error) {
        heldEffort = nil
        isWalkingRunFacts = false
        say(ComposerSeamLine(error))
    }

    /// The Model landed. Takes back only the sentence IT put up — `modeLanded`'s own rule.
    mutating func runFactLanded(model: String) {
        heldModel = nil
        isWalkingRunFacts = false
        guard notice == Self.held(model: model) else { return }
        say(nil)
    }

    /// The Effort rung landed, on the same rule `runFactLanded(model:)` states.
    mutating func runFactLanded(effort: SessionEffort) {
        heldEffort = nil
        isWalkingRunFacts = false
        guard notice == Self.held(effort: effort) else { return }
        say(nil)
    }

    /// A Model the port refused because the CLI's prompt was not free (#558, #1217, #1329): held
    /// for the boundary rather than dropped, and said on the seam — `modeHeld`'s own rule.
    ///
    /// `package`, for the reason `held(_:)` is: a specimen builds the held state by CALLING it
    /// rather than by setting the fields behind one, on `putNext(via:)`'s own rule — `heldModel`
    /// stays package-invisible so no cross-module writer can set it without the notice that
    /// belongs beside it.
    package mutating func runFactHeld(model: String) {
        heldModel = model
        isWalkingRunFacts = false
        say(ComposerSeamLine(Self.held(model: model)))
    }

    /// An Effort rung the port refused for the same reason, held the same way.
    package mutating func runFactHeld(effort: SessionEffort) {
        heldEffort = effort
        isWalkingRunFacts = false
        say(ComposerSeamLine(Self.held(effort: effort)))
    }

    /// The Model and the Effort rung to walk now the Turn has ended, and `nil` where there is
    /// neither or a walk is already under way — `beginModeWalk()`'s own rule, read for both knobs
    /// at once because one boundary carries both.
    mutating func beginRunFactsWalk() -> (model: String?, effort: SessionEffort?)? {
        guard heldModel != nil || heldEffort != nil, !isWalkingRunFacts else { return nil }
        isWalkingRunFacts = true
        return (heldModel, heldEffort)
    }

    /// What the seam says about a Model Argo is holding — `held(_:)`'s own shape, read for the
    /// CLI's own two knobs.
    package static func held(model: String) -> String {
        "\(SessionDriveError.runFactsBusy.detail) — "
            + "\(ReadableModelName.readable(model)) is held until this Turn ends"
    }

    /// What the seam says about an Effort rung Argo is holding.
    package static func held(effort: SessionEffort) -> String {
        "\(SessionDriveError.runFactsBusy.detail) — \(effort.label) is held until this Turn ends"
    }
}
