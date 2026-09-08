import ArgoEngine

// One value per control on the composer's footer row — the `+`, Permission, the run-facts
// line and Send (#558).
//
// Grouped rather than spelled flat on `ComposerFooter`, on the parameter cap's own rule: each of
// these is what ONE control needs, read off one place and passed to one view, so the footer's
// parameter list is the row itself rather than a list of everything on it. What each control SAYS
// is a reading, and what it DOES is a closure; both live here because a control needs both to draw.
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

/// The adapter-authored Permission choices and how to select one.
struct ModePickerControl {
    /// The adapter supplies every visible permission choice and the selected id.
    var permission: SessionPermissionProfile?
    var setPermission: (String) -> Void = { _ in }
    var isPermissionOpenForRender = false
}

/// A Model or an Effort rung picked while a Turn was running, waiting on the boundary to be
/// walked (#1329) — one reading, grouped the way the parameter cap asks: `RunFactsControl` takes
/// this ONE value rather than the two it groups, which is what keeps its own init under the cap.
struct RunFactsHeld: Equatable {
    var model: String?
    var effort: SessionEffort?
}

/// The `Opus 5 · Medium` fact line and the popover it opens (#558).
struct RunFactsControl {
    /// What the Session runs at, and which of its two knobs can be reached at all.
    var facts = RunFacts(model: nil, effort: .unknown(cli: nil))
    var acts = RunFactsActs()
    /// What is held for the boundary. It is what the popover draws instead of a silent click — the
    /// row it names under a held mark.
    var held = RunFactsHeld()
    /// Whether the popover should already be open the instant the footer appears — a Specimen's own
    /// hook, the way `ComposerMenusOpening` is (#689). Production always leaves it `false`: every
    /// render that opens something does it through the click a reader would.
    var isOpenForRender = false
    var setHarness: ((AgentCLI) -> Void)?

    /// What the popover's lock line says while something is held, and `nil` where nothing is
    /// (#1329, formerly #1217's inert sentence). It NAMES what is held rather than the reason a
    /// click did not land — the two sections stay live, so a reader who picks mid-Turn sees the
    /// pick taken and held rather than a control that does nothing.
    var lockWords: String? {
        let names = [
            held.model.map(ReadableModelName.readable),
            held.effort?.label,
        ].compactMap(\.self)
        guard !names.isEmpty else { return nil }
        return "\(names.joined(separator: " · ")) held until this Turn ends"
    }
}

/// What the run-settings popover's controls do.
struct RunFactsActs {
    /// By the id the CLI is asked for, untouched — an alias, or a model name Argo has never heard
    /// of.
    var setModel: (String) -> Void = { _ in }
    var setEffort: (SessionEffort) -> Void = { _ in }
    /// Model and Effort both back where a fresh Session starts.
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
