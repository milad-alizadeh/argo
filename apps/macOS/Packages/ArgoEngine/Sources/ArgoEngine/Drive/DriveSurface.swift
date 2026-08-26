import Foundation

/// What an adapter DECLARES about the surface it drives, as against the acts it performs on one
/// (#761, amending ADR-0024). Three facts that were three port members, and a per-CLI constant in
/// both adapters — a value modelled as behaviour, which is what forced them through every
/// forwarder.
///
/// One value rather than three members because they are read together, off the same port for the
/// same Session at the same moment: the composer decides what to draw once, and a capability that
/// arrived a member at a time could be read against a Session that had since changed.
///
/// Adding a capability is a field here and a value in each adapter. It costs no forwarder anything,
/// which is the whole point of the split.
public struct DriveSurface: Equatable, Sendable {
    /// Whether this surface takes attachments at all (#540) — the composer omits the `+` rather
    /// than disabling it, and a drop is refused with the reason.
    public let takesAttachments: Bool

    /// Whether a `/command` put to this surface fires the CLI's OWN command handling (#685).
    ///
    /// `claude` parses `/` in the input machinery a pasted Turn reaches, while `codex` parses it in
    /// a TUI composer Argo never touches, so there `/foo` arrives as prose the model reads. A
    /// Session whose adapter says no draws no picker at all.
    public let runsCommands: Bool

    /// Whether this surface's CLI resolves an `@path` mention itself (#687), pulling the file in
    /// off the token alone. Where it answers `false`, Argo does the work instead and the Turn names
    /// the file on its own line, exactly as an attachment does — so `@` is offered on both.
    public let resolvesMentions: Bool

    public init(takesAttachments: Bool, runsCommands: Bool, resolvesMentions: Bool) {
        self.takesAttachments = takesAttachments
        self.runsCommands = runsCommands
        self.resolvesMentions = resolvesMentions
    }

    /// Every capability there is. The fakes' default, and the one an adapter that grows a new
    /// capability should have to state rather than inherit.
    public static let everything = DriveSurface(
        takesAttachments: true,
        runsCommands: true,
        resolvesMentions: true,
    )
}
