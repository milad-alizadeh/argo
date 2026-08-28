/// The command a Session started on a Ticket opens on (#899), and the rule that picks it.
///
/// Five rules, FIRST MATCH WINS, and a sixth outcome that is no command at all. A Ticket matching
/// nothing opens an empty composer, because a wrong `/implement` on a decision Ticket is a Session
/// that does the wrong work — and that is worse than one waiting to be told what to do.
///
/// The raw value is the command's own name, so the prompt and the mapping cannot say two things.
public enum WorkCommand: String, Sendable, CaseIterable {
    case designToCode = "design-to-code"
    case grillMe = "grill-me"
    case wayfinder
    case prototype
    case implement

    /// The prompt the fresh Session's first turn carries — a `/command` and the Ticket it is about.
    ///
    /// A seeded prompt is typed input on the CLI's first turn and not a `Skill` call, which is what
    /// lets `/implement` accept it: what that command refuses is a MODEL-issued invocation.
    ///
    /// Every command carries the number, including the four the ticket's own table spelled bare.
    /// Each of these acts on one Ticket, and a command with no subject is one that has to be typed
    /// again — which is the thing this ticket exists to remove.
    public func opening(on ticket: Int) -> String {
        "/\(rawValue) \(ticket)"
    }

    /// Which command a Ticket asks for, and `nil` where it asks for none.
    ///
    /// `designs` is the set of screens `docs/designs/` has settled a design for. Rule 1 cannot be
    /// decided from labels alone — the same Ticket resolves differently in a checkout that has
    /// settled no design for the screen it names — so the resolver reads the tree, not just the
    /// Ticket.
    public static func resolving(_ ticket: Ticket, designs: Set<String>) -> WorkCommand? {
        let labels = Set(ticket.labels.map(\.name))
        if !labels.isDisjoint(with: designs) {
            return .designToCode
        }
        if let asked = asked.first(where: { labels.contains($0.label) }) {
            return asked.command
        }
        return labels.isDisjoint(with: builds) ? nil : .implement
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
