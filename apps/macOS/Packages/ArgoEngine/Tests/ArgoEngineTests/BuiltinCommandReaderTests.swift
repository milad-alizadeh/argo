@testable import ArgoEngine
import Foundation
import Testing

/// How the picker comes to have the CLI's built-ins in it, and what it says while it does not
/// (#686).
@Suite("Built-in command reading")
@MainActor
struct BuiltinCommandReaderTests {
    let machine: BuiltinReaderFixture

    init() throws {
        self.machine = try BuiltinReaderFixture()
    }

    /// Before anything has answered, the picker is not empty and is not lying: every skill is
    /// there, and the half that is still being asked for says so.
    @Test
    func `says the built-in half is still coming before the read lands`() {
        let catalog = machine.reader().catalog(joining: [machine.projectSkill])
        #expect(catalog.builtins == .reading)
        #expect(catalog.commands == [machine.projectSkill])
    }

    @Test
    func `lists the curated built-ins once the panel has been read`() async {
        let reader = machine.reader()
        await machine.finish(reader)

        let catalog = reader.catalog(joining: [])
        #expect(catalog.builtins == .read)
        #expect(catalog.commands.contains { $0.command == "/compact" })
    }

    /// Rule 1 of the curation, proved through the whole read rather than over a list handed
    /// straight to the filter.
    @Test
    func `leaves a terminal-chrome built-in out of the catalog it hands the picker`() async {
        let reader = machine.reader()
        await machine.finish(reader)

        #expect(!reader.catalog(joining: []).commands.contains { $0.command == "/theme" })
    }

    /// Every built-in carries the CLI's own words about it, which is the only reason to ask the
    /// CLI rather than keep a list here.
    @Test
    func `carries the description the CLI itself gave`() async {
        let reader = machine.reader()
        await machine.finish(reader)

        let compact = reader.catalog(joining: []).commands.first { $0.command == "/compact" }
        #expect(compact?.description == "Free up context by summarizing the conversation so far")
    }

    /// The built-ins are the FURTHEST origin, so a bundled skill the user also has installed is
    /// listed under theirs and not twice (design decision 7).
    @Test
    func `leaves out a built-in a nearer origin already answers to`() async {
        let reader = machine.reader()
        await machine.finish(reader)

        let mine = Command(name: "code-review", description: "Mine.", origin: .user)
        let listed = reader.catalog(joining: [mine]).commands
            .filter { $0.command == "/code-review" }
        #expect(listed == [mine])
    }

    /// A hidden session that never showed a panel. The skills stand and the other half is honestly
    /// empty — never a short list presented as the whole one (decision 10).
    @Test
    func `leaves the skills intact and says so when the read fails`() async {
        let reader = machine.reader(showing: ["nothing that is a help panel"])
        await machine.finish(reader)

        let catalog = reader.catalog(joining: [machine.projectSkill])
        #expect(catalog.builtins == .unavailable)
        #expect(catalog.commands == [machine.projectSkill])
    }

    /// The second launch on an unchanged CLI. Nothing is spawned at all, which is the whole point
    /// of keying the answer to the version.
    @Test
    func `starts no hidden session when the kept read is of the CLI now installed`() async {
        await machine.finish(machine.reader())
        let second = machine.reader()
        await machine.finish(second)

        #expect(machine.host.launches.count == 1)
        #expect(second.catalog(joining: []).builtins == .read)
    }

    /// The upgrade case. A CLI that reports a version nothing was kept under is read afresh, so a
    /// command it grew this morning is in this afternoon's picker.
    @Test
    func `reads the panel again once the CLI reports a new version`() async {
        await machine.finish(machine.reader())
        await machine.finish(machine.reader(reporting: "9.9.9 (Claude Code)"))

        #expect(machine.host.launches.count == 2)
    }

    /// One hidden `claude` and not two: a window that asks twice before the first answer lands
    /// must not put a second TUI on the machine.
    @Test
    func `joins the read already in flight rather than starting a second`() async {
        let reader = machine.reader()
        reader.read(inProjectAt: machine.projectURL)
        reader.read(inProjectAt: machine.projectURL)
        await machine.settle()

        #expect(machine.host.launches.count == 1)
    }
}
