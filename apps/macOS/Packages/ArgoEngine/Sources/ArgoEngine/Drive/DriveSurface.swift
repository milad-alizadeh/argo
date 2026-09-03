import Foundation

/// What an adapter DECLARES about the surface it drives, as against the acts it performs on one — a
/// new capability is a field here, never a port member (#761, amending ADR-0024).
///
/// No memberwise default: an adapter that grows a capability has to state its answer, and a fake
/// that inherited one would be asserting a value nobody chose.
public struct DriveSurface: Equatable, Sendable {
    /// Whether this surface takes attachments at all (#540) — the composer omits the `+` rather
    /// than disabling it, and a drop is refused with the reason.
    public let takesAttachments: Bool

    /// Whether a `/command` put to this surface fires the CLI's OWN command handling (#685):
    /// `claude` parses `/` in the input machinery a pasted Turn reaches, while `codex` parses it in
    /// a TUI composer Argo never touches, so there `/foo` arrives as prose the model reads. A
    /// Session whose adapter says no draws no picker at all.
    public let runsCommands: Bool

    /// Whether this surface's CLI resolves an `@path` mention itself (#687), pulling the file in
    /// off the token alone. Where it answers `false`, Argo names the file on its own line instead,
    /// exactly as an attachment does — so `@` is offered on both.
    public let resolvesMentions: Bool

    /// Which of the CLI's own two knobs this surface can be SET on (#558). One value rather than
    /// two flags on the line above, because they are one declaration about one thing — see
    /// `RunFactKnobs`.
    public let chooses: RunFactKnobs

    public init(
        takesAttachments: Bool,
        runsCommands: Bool,
        resolvesMentions: Bool,
        chooses: RunFactKnobs = RunFactKnobs(),
    ) {
        self.takesAttachments = takesAttachments
        self.runsCommands = runsCommands
        self.resolvesMentions = resolvesMentions
        self.chooses = chooses
    }
}

/// Which of Model and Effort an adapter can be SET on (#558) — a declaration, never a discovery.
///
/// Two answers and not one: they are the CLI's own two knobs, an adapter may well expose one and
/// not the other, and a joint answer would take both sections off the popover for the sake of
/// either. `false` on both is the honest default — a surface that has said nothing has declared
/// nothing.
public struct RunFactKnobs: Equatable, Sendable {
    public let model: Bool
    public let effort: Bool

    public init(model: Bool = false, effort: Bool = false) {
        self.model = model
        self.effort = effort
    }

    /// An adapter that can be put on both, which is `claude`'s answer: `/model` and `/effort` reach
    /// the same input machinery a Turn does.
    public static let both = RunFactKnobs(model: true, effort: true)
}
