@testable import ArgoEngine
import Foundation
import Testing

/// What the CLI's own Help panel says its built-in commands are (#686).
///
/// The claim these tests protect is not that the parser works but that it REFUSES: a panel read
/// half-way looks exactly like a CLI with fewer commands, and a picker that lists it is lying about
/// what the Session accepts.
@Suite("Help panel reading")
struct HelpPanelReadingTests {
    @Test
    func `reads every command the panel prints`() throws {
        let read = try HelpPanel.commands(on: HelpPanelFixture.whole())
        #expect(read.count == 99)
    }

    @Test
    func `takes each command's description in the CLI's own words`() throws {
        let read = try HelpPanel.commands(on: HelpPanelFixture.whole())
        let compact = read.first { $0.name == "compact" }
        #expect(compact?.description == "Free up context by summarizing the conversation so far")
    }

    /// The panel clamps a long description to its own width and marks the cut with an ellipsis.
    /// Kept verbatim, cut and all: inventing the rest of the sentence is the one thing a menu
    /// drawn from someone else's catalogue must never do.
    @Test
    func `keeps the ellipsis the panel clamped a long description with`() throws {
        let read = try HelpPanel.commands(on: HelpPanelFixture.whole())
        let clamped = try #require(read.first { $0.name == "loop" }?.description)
        #expect(clamped.hasSuffix("…"))
    }

    /// A `↓` says the list goes on below the last row drawn. Every command past it would simply be
    /// missing, so the read fails rather than answering with the part it could see.
    @Test
    func `refuses a panel that stops mid-list`() throws {
        #expect(throws: HelpPanelError.truncated) {
            try HelpPanel.commands(on: HelpPanelFixture.truncated())
        }
    }

    /// Whatever else went wrong — the wrong tab, a session that never opened, a CLI that renamed
    /// the heading — the panel is not the one this parser knows, and nothing is read from it.
    @Test(arguments: [
        ["   Help  General   Commands   Custom commands", "     /compact", "       Free up."],
        [],
        ["a wall of unrelated terminal output", "with no panel in it at all"],
    ])
    func `refuses a screen carrying no command list`(screen: [String]) throws {
        #expect(throws: HelpPanelError.noCommandList) {
            try HelpPanel.commands(on: screen)
        }
    }

    /// The heading is there and the rows are not. A CLI that renders the tab empty is a CLI Argo
    /// cannot describe, and an empty list presented as whole is the failure this ticket names.
    @Test
    func `refuses a command list with no rows under it`() throws {
        #expect(throws: HelpPanelError.noCommandList) {
            try HelpPanel.commands(on: ["   Browse default commands", "", "   Esc to cancel"])
        }
    }

    /// A row whose description line never came. The name is real and invocable, so it is kept —
    /// the same answer a skill whose frontmatter states no description gets (design decision 5).
    @Test
    func `keeps a command the panel printed no description for`() throws {
        let read = try HelpPanel.commands(on: [
            "   Browse default commands",
            "     /compact",
            "       Free up context.",
            "     /terse",
            "     /clear",
            "       Start a new session.",
        ])
        #expect(read.first { $0.name == "terse" }?.description == nil)
    }
}
