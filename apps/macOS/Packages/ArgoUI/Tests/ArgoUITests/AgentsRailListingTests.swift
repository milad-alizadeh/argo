@testable import ArgoUI
import Testing

/// What the rail LISTS, out of everything the Session delegated (#1090).
///
/// The reader's own words: *hide the subagents that are no longer active*. A rail is glanced at to
/// answer "who else is working", and a fan-out that has landed answers it with thirty rows of work
/// that finished yesterday — the live ones lost among them.
@Suite("Agents rail listing")
struct AgentsRailListingTests {
    /// The ask, in one claim.
    @Test
    func `a finished agent does not occupy the rail`() {
        let listing = AgentsRailListing(of: Self.agents, scopedOnto: nil)

        #expect(listing.listed.map(\.label) == ["out", "still out"])
        #expect(listing.finished.map(\.label) == ["landed"])
    }

    /// Reachable, never gone: a Subagent that finished is how its spend is read at all, and the
    /// rail is the only way into its reading. Revealed, the list is every delegation in handover
    /// order — the order is the record's, not "the live ones first".
    @Test
    func `the finished ones are revealed in the order the work was handed over`() {
        let listing = AgentsRailListing(of: Self.agents, scopedOnto: nil, revealing: true)

        #expect(listing.listed.map(\.label) == ["out", "landed", "still out"])
        #expect(listing.finished.map(\.label) == ["landed"])
    }

    /// The chip the feed is SCOPED onto is never hidden, whatever its state. Hiding it would strand
    /// the reader in a Subagent's feed with no chip to click back from — the same trap
    /// `FeedAgentReader.rows(under:of:otherwise:)` is written against.
    @Test
    func `the agent the feed is scoped onto stays listed`() {
        let listing = AgentsRailListing(of: Self.agents, scopedOnto: 1)

        #expect(listing.listed.map(\.label) == ["out", "landed", "still out"])
        // And it is no longer offered as something to reveal: it is on screen already.
        #expect(listing.finished.isEmpty)
    }

    /// A rail with nothing landed draws no disclosure at all — an affordance that opens onto
    /// nothing is a control that lies about having content behind it.
    @Test
    func `a rail whose agents are all running has nothing to reveal`() {
        let running = Self.agents.filter(\.isRunning)

        #expect(AgentsRailListing(of: running, scopedOnto: nil).finished.isEmpty)
    }

    /// And the state the ticket was written from, read the other way: a Session whose fan-out has
    /// all landed lists nothing, and says so on the disclosure rather than by standing empty.
    @Test
    func `a rail whose agents have all landed lists none of them`() {
        let landed = Self.agents.filter { !$0.isRunning }
        let listing = AgentsRailListing(of: landed, scopedOnto: nil)

        #expect(listing.listed.isEmpty)
        #expect(listing.finished.count == 1)
    }

    /// #1104's defect, in the shape it would take here. That store was short on every real reading
    /// — 311 entries for 313 rows — because two rows saying the same words shared one entry, and
    /// this rail's chips repeat their words harder than any feed: a real fan-out is `Implement
    /// #1027`, `Standards review PR1032`, `Spec review PR1032`, over and over.
    ///
    /// So the split is keyed by the Agent's own `id` — its position among the delegations — and
    /// never by what it was handed. Two Agents given the SAME brief in different states must land
    /// on different sides of the disclosure.
    @Test
    func `two agents handed the same brief are told apart by identity, not by words`() {
        let twins = [
            Self.agent(0, "Standards review PR1032", isRunning: true),
            Self.agent(1, "Standards review PR1032", isRunning: false),
        ]
        let listing = AgentsRailListing(of: twins, scopedOnto: nil)

        #expect(listing.listed.map(\.id) == [0])
        #expect(listing.finished.map(\.id) == [1])
    }

    /// And the same claim about the count the disclosure draws: three identical briefs that have
    /// landed are three, never one folded row.
    @Test
    func `identical briefs that landed are counted once each`() {
        let same = (0 ..< 3).map { Self.agent($0, "Rebase onto main", isRunning: false) }

        #expect(AgentsRailListing(of: same, scopedOnto: nil).finished.count == 3)
    }

    /// The scoped Agent is held out by its id too, so its twin is not held out with it.
    @Test
    func `scoping onto one twin does not list the other`() {
        let twins = (0 ..< 2).map { Self.agent($0, "Spec review PR1032", isRunning: false) }
        let listing = AgentsRailListing(of: twins, scopedOnto: 1)

        #expect(listing.listed.map(\.id) == [1])
        #expect(listing.finished.map(\.id) == [0])
    }

    // MARK: - Fixtures

    /// Two out and one landed, with the landed one in the MIDDLE — a split that kept the record's
    /// order would be indistinguishable from one that sorted the running to the top otherwise.
    private static let agents = [
        agent(0, "out", isRunning: true),
        agent(1, "landed", isRunning: false),
        agent(2, "still out", isRunning: true),
    ]

    private static func agent(_ id: Int, _ label: String, isRunning: Bool) -> FeedAgent {
        FeedAgent(id: id, label: label, isRunning: isRunning, spend: nil)
    }
}
