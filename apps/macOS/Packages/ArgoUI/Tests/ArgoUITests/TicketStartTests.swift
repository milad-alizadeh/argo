import ArgoEngine
@testable import ArgoUI
import Testing

/// What pressing Start on a ticket does (#899): it resolves the command, seeds the spawn with it,
/// and puts the window in the Sessions room on the Session it just started.
@Suite("Ticket start")
@MainActor
struct TicketStartTests {
    /// What the spawn was asked for, and what it answers. A class so the closure can write back.
    private final class Spawn {
        var asked: Ask?
        var answer: String? = "fresh-session"
    }

    private struct Ask {
        let ticket: Int
        let mode: SessionMode
        let opening: String?
    }

    private static let tickets = [
        Ticket(number: 899, title: "Start", status: "Todo", closure: .open, labels: [
            TicketLabel(name: "enhancement"),
        ]),
        Ticket(number: 609, title: "The work room", status: "Todo", closure: .open, labels: [
            TicketLabel(name: "work-room"),
        ]),
        Ticket(number: 607, title: "The destination", status: "Todo", closure: .open),
    ]

    private func start(_ spawn: Spawn) -> TicketStart {
        TicketStart(tickets: Self.tickets, designs: ["work-room"]) { ticket, mode, opening in
            spawn.asked = Ask(ticket: ticket, mode: mode, opening: opening)
            return spawn.answer
        }
    }

    @Test func `a started Session opens on the command its ticket asks for`() async {
        let spawn = Spawn()

        await start(spawn).run(on: 899, in: CockpitNavigationModel())

        #expect(spawn.asked?.opening == "/implement 899")
    }

    /// Rule 1 needs the tree, so the same press on a ticket naming a screen with a design sends the
    /// design route instead — `AGENTS.md`'s rule, taken rather than guessed.
    @Test func `a ticket naming a designed screen starts on the design route`() async {
        let spawn = Spawn()

        await start(spawn).run(on: 609, in: CockpitNavigationModel())

        #expect(spawn.asked?.opening == "/design-to-code 609")
    }

    @Test func `a ticket that asks for no command starts with an empty composer`() async {
        let spawn = Spawn()

        await start(spawn).run(on: 607, in: CockpitNavigationModel())

        #expect(spawn.asked?.opening == nil)
    }

    /// `Code` is the rung work needs, and the only one this room offers (#872).
    @Test func `a Session started on a ticket stands on the Code rung`() async {
        let spawn = Spawn()

        await start(spawn).run(on: 899, in: CockpitNavigationModel())

        #expect(spawn.asked?.mode == .code)
    }

    /// The reversal #899 is about: a Start that begins real work has its answer in the other room,
    /// and staying put hides it.
    @Test func `a started Session is what the window is left looking at`() async {
        let navigation = CockpitNavigationModel()
        navigation.room = .tickets

        await start(Spawn()).run(on: 899, in: navigation)

        #expect(navigation.room == .sessions)
        #expect(navigation.session == "fresh-session")
    }

    /// A refusal is reported by the app, and the reader is left looking at the list they were
    /// triaging rather than at an empty room.
    @Test func `a refused spawn leaves the room where it was`() async {
        let spawn = Spawn()
        spawn.answer = nil
        let navigation = CockpitNavigationModel()
        navigation.room = .tickets

        await start(spawn).run(on: 899, in: navigation)

        #expect(navigation.room == .tickets)
        #expect(navigation.session == nil)
    }

    /// The press must be aimable, so the command is a value the control can draw before it is
    /// pressed — not something only the act knows.
    @Test(arguments: [(899, WorkCommand.implement), (609, .designToCode)])
    func `the command Start will send is readable before it is pressed`(
        ticket: Int, command: WorkCommand,
    ) {
        #expect(start(Spawn()).command(on: ticket) == command)
    }

    @Test func `a ticket the listing does not hold asks for no command`() {
        #expect(start(Spawn()).command(on: 1) == nil)
    }
}
