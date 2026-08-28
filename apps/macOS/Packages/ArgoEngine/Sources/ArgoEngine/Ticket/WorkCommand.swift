/// The command a Session started on a Ticket opens on (#899), and the rule that picks it.
///
/// Five rules, FIRST MATCH WINS, and a sixth outcome that is no command at all. A Ticket matching
/// nothing opens an empty composer, because a wrong `/implement` on a decision Ticket is a Session
/// that does the wrong work — and that is worse than one waiting to be told what to do.
///
/// The raw value is the command's own name, so the prompt and the mapping cannot say two things.
public enum WorkCommand: String, Sendable {
    case designToCode = "design-to-code"
    case grillMe = "grill-me"
    case wayfinder
    case prototype
    case implement

    /// How the command is written and spoken — the one place the leading slash is spelled.
    public var typed: String {
        "/\(rawValue)"
    }

    /// The prompt the fresh Session's first turn carries: the command, and the Ticket it is about.
    ///
    /// A seeded prompt is a POSITIONAL on argv and so is typed input on the CLI's first turn, not a
    /// `Skill` call — which is what lets `/implement` accept it while still refusing a model-issued
    /// invocation. Verified against `claude` on 2026-08-28: a skill handed to it as `/name` on argv
    /// ran, rather than being answered as prose about a slash command.
    ///
    /// Every command carries the number, including the four the ticket's own table spelled bare.
    /// Each of these acts on one Ticket, and a command with no subject is one that has to be typed
    /// again — which is the thing this ticket exists to remove.
    public func opening(on ticket: Int) -> String {
        "\(typed) \(ticket)"
    }

    /// Which command a Ticket asks for, and `nil` where it asks for none.
    ///
    /// `designs` is the set of screens `docs/designs/` has settled a design for. Rule 1 cannot be
    /// decided from labels alone — the same Ticket resolves differently in a checkout that has
    /// settled no design for the screen it names — so the resolver reads the tree, not just the
    /// Ticket.
    public static func resolving(_ ticket: Ticket, designs: Set<String>) -> WorkCommand? {
        if names(designs, in: ticket) {
            return .designToCode
        }
        let labels = Set(ticket.labels.map(\.name))
        if let asked = asked.first(where: { labels.contains($0.label) }) {
            return asked.command
        }
        return labels.isDisjoint(with: builds) ? nil : .implement
    }

    /// Rule 1: does this Ticket NAME a screen the tree has a design for?
    ///
    /// The title as well as the labels, because this tracker has no per-screen label and never has
    /// — a rule that only read labels would be the load-bearing one that never fires. A screen's
    /// name is a slug, so it is matched against the title as the words it is made of.
    ///
    /// The body is deliberately not read: a screen mentioned in passing halfway down a ticket is
    /// not the screen that ticket is about, and rule 1 outranks every rule below it.
    ///
    /// Only a MULTI-WORD name is looked for in the title. `docs/designs/` holds `cockpit-spec.md`
    /// among the studies, and a one-word name is a word before it is a screen — matching it would
    /// send every ticket whose title says "spec" down the design route.
    private static func names(_ designs: Set<String>, in ticket: Ticket) -> Bool {
        let labels = Set(ticket.labels.map(\.name))
        guard labels.isDisjoint(with: designs) else { return true }
        let title = ticket.title.lowercased()
        return designs.filter { $0.contains("-") }
            .contains { title.contains($0.replacingOccurrences(of: "-", with: " ")) }
    }

    /// Rules 2, 3 and 4 — the `wayfinder:*` family, which is the tracker's own name for three of
    /// the four rows. In rule ORDER and in an array rather than a dictionary: first match wins is
    /// the mapping's rule, and a `Set`'s iteration order would settle a Ticket carrying two of
    /// them at random.
    private static let asked: [(label: String, command: WorkCommand)] = [
        ("wayfinder:grilling", .grillMe),
        ("wayfinder:map", .wayfinder),
        ("wayfinder:prototype", .prototype),
    ]

    /// Rule 5's labels, which are a NAMED SET and not a catch-all: a Ticket carrying none of them
    /// and matching no rule above gets no command, which is the honest empty composer.
    private static let builds: Set<String> = [
        "bug", "enhancement", "ready-for-agent", "wayfinder:task",
    ]
}
