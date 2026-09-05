/// What a Session started on a Ticket opens on — the rule that picks its command (#899), and
/// the rung it stands on (#941).
///
/// Eight rules, FIRST MATCH WINS, and the last of them is the default: `/implement`. A Ticket has
/// to say it is NOT build work rather than that it is (#1182), because most tickets in this
/// tracker are filed with no labels at all.
///
/// The two refusing sets sit either side of rule 6's build labels, and which side is the whole of
/// their meaning. `notForAnAgent` outranks a build label; `notYetSettled` loses to one.
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
    /// under it (#1182). It says what the two have in common and nothing more: a `bug` beside a
    /// `needs-triage` is reached by the build label, and "no label says otherwise" printed beside
    /// it would name the one that did and lost.
    public static func why(_ command: WorkCommand) -> String? {
        switch command {
        case .designToCode: "the screen has a design"
        case .grillMe: "labelled wayfinder:grilling"
        case .wayfinder: "labelled wayfinder:map"
        case .prototype: "labelled wayfinder:prototype"
        case .implement: "nothing refuses it"
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
        guard labels.isDisjoint(with: notForAnAgent) else { return nil }
        guard labels.isDisjoint(with: builds) else { return .implement }
        return labels.isDisjoint(with: notYetSettled) ? .implement : nil
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

    /// Rule 5: not an agent's work, whatever KIND of work it is — so it is read before the build
    /// labels and beats them. Three say the Ticket will never be actioned and one reserves it for
    /// a person, and a build label beside any of them does not make it an agent's again: 3 Tickets
    /// here carry `ready-for-human` next to `bug` or `enhancement`, and 2 carry `duplicate`.
    private static let notForAnAgent: Set<String> = [
        "wontfix", "duplicate", "invalid", "ready-for-human",
    ]

    /// Rule 6: the labels that say a Ticket IS build work. The last rule answers `.implement` too,
    /// so the only effect left to this set is to OUTRANK rule 7 — `needs-triage` beside a `bug`
    /// loses, and it has to: it rides along on about fifty of this tracker's build tickets.
    private static let builds: Set<String> = [
        "bug", "enhancement", "ready-for-agent", "wayfinder:task",
    ]

    /// Rule 7: not settled YET, which is a different claim and loses to a build label. A Ticket
    /// that says `bug` has said what it is, whatever else is still open about it.
    ///
    /// Both sets are closed BY DESIGN, which looks like the wrong way round: a label added to the
    /// tracker tomorrow reads as build work until it is named in one of them. That fails towards a
    /// Session a reader can see and stop, rather than an empty composer they cannot tell from a
    /// broken button. Four of the strings across the two sets are triage labels
    /// `docs/agents/triage-labels.md` owns — keep the two in step.
    private static let notYetSettled: Set<String> = [
        "question", "needs-triage", "needs-info", "wayfinder:research",
    ]
}
