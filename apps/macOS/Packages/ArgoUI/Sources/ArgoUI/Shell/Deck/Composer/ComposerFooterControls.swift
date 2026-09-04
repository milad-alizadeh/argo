import ArgoEngine

// One value per control on the composer's footer row — the `+`, the Mode picker, the run-facts
// line and Send (#558).
//
// Grouped rather than spelled flat on `ComposerFooter`, on edge 6's own rule: each of these is
// what ONE control needs, read off one place and passed to one view, so the footer's parameter
// list is the row itself rather than a list of everything on it. What each control SAYS is a
// reading, and what it DOES is a closure; both live here because a control needs both to draw.
//
// Every act is inert by default and every capability `false`, so a specimen renders the whole row
// with no Session behind it.

/// The `+` and its drawer.
///
/// `canAdd` false takes the button off the row ENTIRELY rather than greying it (design decision 9,
/// 11) — which is why the two acts beside it are inert rather than optional: a control that is
/// absent needs no disabled state to fall back to.
struct AddButtonControl {
    /// Whether `AddMenu` would have at least one row. Read off `ComposerMenuLine`
    /// (`workspaceRoot`, `canRunCommands`) and DELIBERATELY not off `canAttach`: a drop and a paste
    /// answer to `canAttach` on their own, through `AttachmentDropTarget`, and `+` no longer opens
    /// a file picker of its own for `canAttach` to gate (design decision 12).
    var canAdd = false
    var isOpen = false
    var toggle: () -> Void = {}
}

/// The Mode ladder: what Argo can say the Session's stance is, what is being held against a Turn's
/// end, and how to move it (#545, #940).
struct ModePickerControl {
    /// A READING and not a binding: what the control shows comes back off the Session, so the
    /// footer holds no stance of its own.
    var reading = SessionModeReading.unknown(cli: nil)
    /// A rung picked while a Turn was running, held for the boundary (#940). It is what the picker
    /// draws while it waits, under `≈` — never as the rung the Session stands on.
    var heldMode: SessionMode?
    var setMode: (SessionMode) -> Void = { _ in }
}

/// The `Opus 5 · Medium` fact line and the popover it opens (#558).
struct RunFactsControl {
    /// What the Session runs at, and which of its two knobs can be reached at all.
    var facts = RunFacts(model: nil, effort: .unknown(cli: nil))
    var acts = RunFactsActs()
    /// Whether the CLI's prompt is free to take a line typed at it. The port refuses both knobs
    /// while it is not (`runFactsBusy`), so this is what the popover draws inert rather than a
    /// click it cannot honour (#1217).
    var takesTypedLine = true
    /// Whether the popover should already be open the instant the footer appears — a Specimen's own
    /// hook, the way `ComposerMenusOpening` is (#689). Production always leaves it `false`: every
    /// render that opens something does it through the click a reader would.
    var isOpenForRender = false

    /// Why the two knobs are inert, or `nil` where they are not (#1217).
    ///
    /// The PORT's own sentence and never a second spelling of it: what the popover says about a
    /// refusal has to be what the refusal says, or the two drift the first time one is reworded.
    /// Words rather than a flag, because a control drawn inert without a reason is the silent
    /// click this ticket is about wearing a lower opacity.
    var lockWords: String? {
        takesTypedLine ? nil : SessionDriveError.runFactsBusy.detail
    }
}

/// What the run-settings popover's three controls do.
struct RunFactsActs {
    /// By the id the CLI is asked for, untouched — an alias, or a model name Argo has never heard
    /// of.
    var setModel: (String) -> Void = { _ in }
    var setEffort: (SessionEffort) -> Void = { _ in }
    /// Mode, Model and Effort all back where a fresh Session starts. It sets Mode too, which is why
    /// the popover's one sentence about Mode belongs to this button.
    var reset: () -> Void = {}
}

/// Send, and the Stop it becomes mid-Turn (#541).
struct SendButtonControl {
    var isSendable = false
    /// Whether a Turn is in flight, which is what turns the control into Stop.
    var isRunning = false
    var send: () -> Void = {}
    var stop: () -> Void = {}
}
