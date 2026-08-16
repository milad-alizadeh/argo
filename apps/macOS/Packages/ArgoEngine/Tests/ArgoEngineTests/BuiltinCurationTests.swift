@testable import ArgoEngine
import Foundation
import Testing

/// Which of the CLI's built-ins the picker actually offers (#686, settled by the #589 grill).
///
/// The curation is the one hand-maintained part of this feature, and it is a list of what to LEAVE
/// OUT on purpose. A name it has not heard of is shown un-curated, which is noise; a list of names
/// to keep would instead hide a command the Session really accepts.
@Suite("Built-in curation")
struct BuiltinCurationTests {
    /// Rule 1 of three: the terminal is not a surface the cockpit has.
    @Test(arguments: ["theme", "keybindings", "scroll-speed", "exit", "tui"])
    func `leaves out a command about the terminal itself`(name: String) {
        #expect(!BuiltinCuration.keeps(named(name)).contains { $0.name == name })
    }

    /// Rule 2: Argo draws these itself, so a row here would be a second way to the same thing —
    /// and the CLI's own version of it would land somewhere the cockpit does not draw.
    @Test(arguments: ["resume", "model", "effort", "permissions", "diff", "usage"])
    func `leaves out a command whose surface Argo already owns`(name: String) {
        #expect(!BuiltinCuration.keeps(named(name)).contains { $0.name == name })
    }

    /// Rule 3: what is really a prompt or an act on the Session's own state.
    @Test(arguments: ["compact", "clear", "plan", "init", "rename", "code-review"])
    func `keeps a command that is a prompt or an act on the Session`(name: String) {
        #expect(BuiltinCuration.keeps(named(name)).contains { $0.name == name })
    }

    /// The whole point of curating by veto. A `claude` that grows a command tomorrow shows it
    /// tomorrow, un-curated and noisy — which is recoverable, unlike a command the picker denies
    /// exists while the Session accepts it.
    @Test
    func `keeps a command the curation has never heard of`() {
        let unheard = BuiltinCommand(name: "not-shipped-yet", description: "From a later CLI.")
        #expect(BuiltinCuration.keeps([unheard]) == [unheard])
    }

    /// Order is the panel's, and the panel's is alphabetical. Dropping rows must not reorder what
    /// is left, because that order is what the picker's section draws.
    @Test
    func `leaves the panel's own order alone`() {
        let read = named("clear", "theme", "compact", "exit", "plan")
        #expect(BuiltinCuration.keeps(read).map(\.name) == ["clear", "compact", "plan"])
    }

    /// The description travels untouched: these are the CLI's own words, and the curation decides
    /// only whether a row is shown.
    @Test
    func `carries each kept command's description through unchanged`() {
        let compact = BuiltinCommand(name: "compact", description: "Free up context.")
        #expect(BuiltinCuration.keeps([compact]) == [compact])
    }

    /// The table against the panel it was written from. 99 read, 59 vetoed, 40 offered — the
    /// arithmetic of the #589 grill's own row-by-row verdicts, which is the only thing that can
    /// tell a veto list that has drifted from one that is merely long.
    @Test
    func `offers forty of the ninety-nine the captured panel lists`() throws {
        let read = try HelpPanel.commands(on: HelpPanelFixture.whole())
        #expect(BuiltinCuration.keeps(read).count == 40)
    }

    private func named(_ names: String...) -> [BuiltinCommand] {
        named(names)
    }

    private func named(_ names: [String]) -> [BuiltinCommand] {
        names.map { BuiltinCommand(name: $0, description: "Whatever the panel said.") }
    }
}
