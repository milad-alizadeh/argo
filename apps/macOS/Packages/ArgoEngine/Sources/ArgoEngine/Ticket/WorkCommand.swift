/// What a Session started on a Ticket opens on — the rule that picks its command (#899), and
/// the rung it stands on (#941).
///
/// Seven rules, FIRST MATCH WINS. Rules 1 to 5 read a Ticket that says what it wants; rule 6 is a
/// named set of REFUSALS that opens an empty composer; rule 7 is the default, and it is
/// `/implement`.
///
/// Rule 7 used to be the refusal, on the reasoning that a wrong `/implement` on a decision Ticket
/// is a Session that does the wrong work. That reasoning only holds where the labels are
/// maintained, and in this tracker they are not: most tickets are filed with no labels at all, so
/// the fall-through written for decision Tickets was in practice the fall-through for MOST
/// Tickets, and `/implement` — the whole point of pressing Start — almost never fired (#1182).
///
/// So the burden moved. A Ticket no longer has to say it is build work; it has to say it is NOT,
/// and rule 6 is the closed set of ways to say so. The cost of the swap is bounded in the
/// direction that matters: a Session opened on the wrong `/implement` is one a reader can see and
/// stop, whereas the empty composer it replaced looked exactly like a Start that did nothing.
///
/// The raw value is the command's own name, so the prompt and the mapping cannot say two things.
public enum WorkCommand: String, Sendable {
    case designToCode = "design-to-code"
    case grillMe = "grill-me"
    case wayfinder
    case prototype
    case implement
    /// Offered and never RESOLVED. No rule guesses `/triage` — deciding for a reader that a ticket
    /// needs triaging is the guess triage exists to answer — but it is the command a reader most
    /// often wants over a ticket the resolver had nothing to say about, so the picker carries it
    /// (#1242). A case with no rule is not a gap in the mapping; it is a command the mapping has
    /// no business asserting.
    case triage

    /// The rung a Session started FROM A TICKET opens on (#941). Argo's own choice for that one
    /// Session, never filed as the rung last picked (#629), so a hand-started Session is untouched.
    ///
    /// Not per-case: a Ticket matching no rule gets no command and still needs a rung.
    public static let startingMode: SessionMode = .auto

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

    /// What the skill picker offers, in the order it lists them (#1242). Written down rather than
    /// taken from `allCases`, because the order a reader reads is not the order the rules fire in:
    /// the two commands a ticket most often wants come first, and the three `wayfinder:*` ones
    /// follow. A case added to this enum is absent from the picker until somebody decides where in
    /// that reading it belongs — which is the decision `allCases` would make silently.
    public static let offered: [WorkCommand] = [
        .implement, .designToCode, .grillMe, .triage, .prototype, .wayfinder,
    ]

    /// Why the resolver picked this command, in the reader's words, and `nil` for one no rule ever
    /// picks. Said only beside the command that DID match — `StartSkillMenu` enforces that, because
    /// a rule printed beside a command nobody picked reads as a claim about that command.
    ///
    /// `implement`'s reason is worded for BOTH ways it is reached, the build label and the default
    /// under it (#1182). It used to read "matched by label", which an unlabelled Ticket would have
    /// made into a straight falsehood printed beside the command it explains.
    public static func why(_ command: WorkCommand) -> String? {
        switch command {
        case .designToCode: "the screen has a design"
        case .grillMe: "labelled wayfinder:grilling"
        case .wayfinder: "labelled wayfinder:map"
        case .prototype: "labelled wayfinder:prototype"
        case .implement: "no label says otherwise"
        // No rule resolves it, so there is never a reason to give beside it.
        case .triage: nil
        }
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
        if !labels.isDisjoint(with: builds) {
            return .implement
        }
        return labels.isDisjoint(with: refusals) ? .implement : nil
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

    /// Rule 5's labels: a Ticket that SAYS it is build work. It is checked before rule 6 so that a
    /// refusal riding along beside a build label loses — `needs-triage` sits on a great many
    /// Tickets that are plainly bugs, and a Ticket that says `bug` has said what it is.
    private static let builds: Set<String> = [
        "bug", "enhancement", "ready-for-agent", "wayfinder:task",
    ]

    /// Rule 6: the labels that say this Ticket is NOT build work, and the only way to get no
    /// command. Each is a different way of saying it — it is a question (`question`), it is not
    /// settled (`needs-triage`, `needs-info`), it is somebody else's (`ready-for-human`), it is
    /// reading rather than building (`wayfinder:research`), or it is not going to be actioned at
    /// all (`wontfix`, `duplicate`, `invalid`).
    ///
    /// This set is the one that must stay maintained, and it is the closed one BY DESIGN: a label
    /// added to the tracker tomorrow reads as build work until it is named here, which fails
    /// towards the Session a reader can see rather than the empty composer they cannot tell from a
    /// broken button.
    private static let refusals: Set<String> = [
        "question", "needs-triage", "needs-info", "ready-for-human", "wayfinder:research",
        "wontfix", "duplicate", "invalid",
    ]
}
