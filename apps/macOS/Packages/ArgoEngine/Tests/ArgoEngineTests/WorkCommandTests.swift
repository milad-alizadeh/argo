@testable import ArgoEngine
import Testing

/// Which command a Session started on a ticket opens on (#899), and which tickets get none.
///
/// The mapping is the ticket's agreed content, so the rows below are the specification: five rules,
/// first match wins, and a sixth outcome that is deliberately no command at all.
@Suite("Work command")
struct WorkCommandTests {
    /// The screens this repo has settled a design for, as `docs/designs/` names them.
    private static let designs: Set<String> = ["work-room", "composer-picker"]

    private static func ticket(_ labels: [String]) -> Ticket {
        Ticket(
            number: 899,
            title: "Start goes to the Session and opens it on the command the ticket asks for",
            status: "Todo",
            closure: .open,
            labels: labels.map { TicketLabel(name: $0) },
        )
    }

    @Test(arguments: [
        (["work-room", "enhancement"], WorkCommand.designToCode),
        (["wayfinder:grilling"], .grillMe),
        (["wayfinder:map"], .wayfinder),
        (["wayfinder:prototype"], .prototype),
        (["wayfinder:task"], .implement),
        (["bug"], .implement),
        (["enhancement", "needs-triage"], .implement),
        (["ready-for-agent"], .implement),
    ])
    func `a ticket opens the Session on the command its labels ask for`(
        labels: [String], command: WorkCommand,
    ) {
        #expect(WorkCommand.resolving(Self.ticket(labels), designs: Self.designs) == command)
    }

    @Test(arguments: [["needs-triage"], ["ready-for-human"], [], ["wayfinder:research"]])
    func `a ticket that matches no rule asks for no command`(labels: [String]) {
        #expect(WorkCommand.resolving(Self.ticket(labels), designs: Self.designs) == nil)
    }

    /// Rule 1 before rule 5, which is the repo rule `AGENTS.md` states: a UI ticket whose screen
    /// has
    /// a design is never built with `implement`.
    @Test func `a named screen with a design outranks the build label beside it`() {
        #expect(
            WorkCommand.resolving(
                Self.ticket(["enhancement", "composer-picker"]),
                designs: Self.designs,
            )
                == .designToCode,
        )
    }

    /// The lookup is against the tree, not the label: the same ticket resolves differently in a
    /// checkout that has settled no design for the screen it names.
    @Test func `a named screen with no design falls through to the build label`() {
        #expect(WorkCommand.resolving(Self.ticket(["work-room", "bug"]), designs: []) == .implement)
    }

    @Test(arguments: [
        (WorkCommand.designToCode, "/design-to-code 899"),
        (.grillMe, "/grill-me 899"),
        (.wayfinder, "/wayfinder 899"),
        (.prototype, "/prototype 899"),
        (.implement, "/implement 899"),
    ])
    func `the opening prompt names the command and the ticket it is about`(
        command: WorkCommand, opening: String,
    ) {
        #expect(command.opening(on: 899) == opening)
    }
}
