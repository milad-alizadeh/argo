import ArgoEngine

/// What the composer holds about the RUNG the Session is on, and about the two knobs beside it
/// (#545, #558, #653, #940).
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

    /// The port's reason a Model or Effort did not land (#558), on the seam the same way — no words
    /// are at risk here either, so there is nothing for Retry to put back.
    ///
    /// It touches NO held state, which is what separates it from `modeRefused` above: a rung can be
    /// kept for the Turn's boundary, and these two are not. The composer goes on showing what the
    /// CLI is still on, which was never wrong.
    mutating func runFactRefused(_ error: any Error) {
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
}
