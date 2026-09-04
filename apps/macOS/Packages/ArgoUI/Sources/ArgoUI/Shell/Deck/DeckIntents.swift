import ArgoEngine
import SwiftUI

/// What the deck's one vessel DOES — the closures that reach the selected Session, beside the
/// `DeckVessel` value that says what is drawn. Every intent is inert by default, so a specimen
/// renders the vessel without a terminal behind it.
package struct DeckIntents {
    /// One Turn to the shown Session; refusals are thrown back and the composer's seam repeats
    /// them.
    var send: ComposerSend = { _, _ in }
    /// The answer to the Permission in the slot.
    var decide: (PermissionDecision) -> Void = { _ in }
    /// Taking back one of the Session's standing allows, by tool (#572). Reached from BOTH the
    /// composer and the prompt, because either can draw the tray.
    var revoke: (String) -> Void = { _ in }
    /// Saying the Turn reported lost has been put back in the field (#682), so the Hub stops
    /// reporting it. The composer's own act: it is the thing that took the news in.
    var lostTurnSeen: () -> Void = {}
    /// What can be done to the Turn already in flight — stopping it, and steering a waiting
    /// follow-up into it. One value for the reason `settings` below is one: they are one reading
    /// of the Session, and both begin with the same `ESC`.
    package var turn = SessionTurnIntents()
    /// The three standing things the footer can put the Session on — its Mode rung, its Model and
    /// its Effort (#545, #558). One value because they are one row of controls and one act binds
    /// them: the popover's reset sets all three.
    var settings = SessionSettingIntents()
    /// The exit the undriveable line offers: a fresh Session in the shown one's folder.
    var spawnBeside: () async -> Void = {}
    /// Every skill installed for this Project (#685). A closure and not a value, because it is READ
    /// AFRESH each time the menu opens — that is what puts a skill installed mid-Session in the
    /// list with no watcher and no restart — and never on the keystrokes after it (#961). The
    /// filesystem stays on this side of it: what the view holds is whatever the last call answered.
    /// `async` the way `files` is, because a walk of the skills directories may not land on the
    /// actor that draws the caret (ADR-0028 Rule 6).
    var commands: () async -> CommandCatalog = { CommandCatalog.empty }
    /// Every file in the shown Session's Workspace (#687), read afresh the way `commands` is —
    /// which is what puts a file written mid-Session in the very next list. `async` because the
    /// tree can be enormous and the composer may not wait on it.
    var files: () async -> [String] = { [] }
    /// What the composer is holding. A binding handed in from ABOVE the deck's Session identity:
    /// `.id(session)` discards everything under it on a switch, and an unsent draft must survive
    /// one (#539).
    var draft: Binding<ComposerDraft> = .constant(ComposerDraft())

    /// Controls that reach nothing, for a specimen or a `#Preview` with no Session behind them.
    @MainActor static let inert = DeckIntents()

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        send: @escaping ComposerSend = { _, _ in },
        decide: @escaping (PermissionDecision) -> Void = { _ in },
        revoke: @escaping (String) -> Void = { _ in },
        lostTurnSeen: @escaping () -> Void = {},
        turn: SessionTurnIntents = SessionTurnIntents(),
        settings: SessionSettingIntents = SessionSettingIntents(),
        spawnBeside: @escaping () async -> Void = {},
        commands: @escaping () async -> CommandCatalog = { CommandCatalog.empty },
        files: @escaping () async -> [String] = { [] },
        draft: Binding<ComposerDraft> = .constant(ComposerDraft()),
    ) {
        self.send = send
        self.decide = decide
        self.revoke = revoke
        self.lostTurnSeen = lostTurnSeen
        self.turn = turn
        self.settings = settings
        self.spawnBeside = spawnBeside
        self.commands = commands
        self.files = files
        self.draft = draft
    }
}
