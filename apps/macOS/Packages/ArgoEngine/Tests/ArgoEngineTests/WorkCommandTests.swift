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

    private static func ticket(
        _ labels: [String],
        titled title: String = "Start goes to the Session and opens on the right command",
    )
        -> Ticket {
        Ticket(
            number: 899,
            title: title,
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

    /// Rule 6 is a NAMED SET of refusals, and it is the only way to get no command. Each of these
    /// labels says the Ticket is not build work — it is a question, it is somebody else's, or it is
    /// not ready — so `Start` opens the empty composer that says so.
    @Test(arguments: [
        ["needs-triage"], ["ready-for-human"], ["wayfinder:research"], ["question"], ["wontfix"],
        ["needs-info"], ["duplicate"], ["invalid"],
    ])
    func `a ticket that says it is not build work asks for no command`(labels: [String]) {
        #expect(WorkCommand.resolving(Self.ticket(labels), designs: Self.designs) == nil)
    }

    /// The point of #1182. Most tickets in this tracker are filed with no labels at all, so a
    /// fall-through that refused them was in practice the fall-through for MOST tickets, and
    /// `/implement` — the whole point of pressing Start — almost never fired. An unlabelled Ticket
    /// now reads as what Start reads as.
    @Test func `an unlabelled ticket opens on implement`() {
        #expect(WorkCommand.resolving(Self.ticket([]), designs: Self.designs) == .implement)
    }

    /// Rule 7 is a DEFAULT and not a named set, so a label nobody listed does not refuse the
    /// Ticket. `documentation` and `skills-drift` are build work that the old closed set happened
    /// not to name, and a label added to the tracker tomorrow is build work too until rule 6 says
    /// otherwise.
    @Test(arguments: [["documentation"], ["skills-drift"], ["good first issue"], ["help wanted"]])
    func `a ticket labelled with none of the rules still opens on implement`(labels: [String]) {
        #expect(WorkCommand.resolving(Self.ticket(labels), designs: Self.designs) == .implement)
    }

    /// Rule 5 before rule 6: a refusal beside a build label loses. `needs-triage` rides along on a
    /// great many tickets that are plainly build work, and a Ticket that says `bug` has said what
    /// it is.
    @Test(arguments: [["enhancement", "needs-triage"], ["bug", "needs-info"]])
    func `a build label outranks a refusal beside it`(labels: [String]) {
        #expect(WorkCommand.resolving(Self.ticket(labels), designs: Self.designs) == .implement)
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

    /// This tracker has no per-screen label and never has, so a rule 1 that only read labels would
    /// be the load-bearing rule that never fires. A ticket names its screen in its TITLE, and a
    /// screen's name is a slug read back as the words it is made of.
    @Test(arguments: [
        "The Work room's four verbs do what they draw",
        "The composer picker lists what is installed",
    ])
    func `a ticket whose title names a designed screen takes the design route`(title: String) {
        #expect(
            WorkCommand.resolving(
                Self.ticket(["enhancement"], titled: title),
                designs: Self.designs,
            )
                == .designToCode,
        )
    }

    /// `docs/designs/` really does hold a `cockpit-spec.md`, so its screen is named `spec`. A
    /// one-word name is a word before it is a screen, and matching it in a title would send every
    /// ticket that says "spec" down the design route.
    @Test func `a one-word screen name is not looked for in the title`() {
        let named = Self.ticket(["bug"], titled: "The failure states spec contradicts itself")

        #expect(WorkCommand.resolving(named, designs: ["spec", "work-room"]) == .implement)
    }

    /// The BODY is not read: a screen mentioned in passing halfway down a ticket is not the screen
    /// that ticket is about, and rule 1 outranks every rule below it.
    @Test func `a ticket that only mentions a screen in passing is not a design ticket`() {
        let mentions = Ticket(
            number: 899,
            title: "The idle heartbeat published what had not changed",
            status: "Todo",
            closure: .open,
            labels: [TicketLabel(name: "bug")],
            body: "Seen while reading the work room, but the fault is in the poll.",
        )

        #expect(WorkCommand.resolving(mentions, designs: Self.designs) == .implement)
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
