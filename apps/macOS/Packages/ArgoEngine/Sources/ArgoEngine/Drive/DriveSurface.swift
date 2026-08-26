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

    public init(takesAttachments: Bool, runsCommands: Bool, resolvesMentions: Bool) {
        self.takesAttachments = takesAttachments
        self.runsCommands = runsCommands
        self.resolvesMentions = resolvesMentions
    }
}
