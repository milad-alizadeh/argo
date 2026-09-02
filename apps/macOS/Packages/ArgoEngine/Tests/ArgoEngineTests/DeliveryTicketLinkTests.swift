@testable import ArgoEngine
import Testing

/// Which Ticket a branch serves, by the precedence ADR-0014 fixed: native reference →
/// id-in-branch → unlinked.
@Suite("Delivery to Ticket join")
struct DeliveryTicketLinkTests {
    private static func link(
        branch: String, body: String? = nil, asserted: Int? = nil,
    )
        -> DeliveryTicketLink {
        .derived(branch: branch, pullRequestBody: body, asserted: asserted)
    }

    @Test
    func `the host's own closing reference outranks the number in the branch`() {
        #expect(Self.link(branch: "argo/#99-spike", body: "Closes #258") == .native(258))
    }

    struct KeywordCase: Sendable {
        let body: String
        let number: Int?
    }

    /// The nine keywords GitHub itself acts on, and the bodies that name no ticket at all.
    private static let keywords = [
        KeywordCase(body: "Closes #258", number: 258),
        KeywordCase(body: "fixes #258", number: 258),
        KeywordCase(body: "Resolved #258", number: 258),
        KeywordCase(body: "Part of #258", number: nil),
        KeywordCase(body: "Closes the gap", number: nil),
        KeywordCase(body: "Closes #0", number: nil),
    ]

    @Test(arguments: keywords)
    func `a closing keyword is what makes a body name a ticket`(_ example: KeywordCase) {
        let link = Self.link(branch: "hotfix", body: example.body)

        #expect(link == example.number.map(DeliveryTicketLink.native) ?? .unlinked)
    }

    @Test
    func `a branch carrying a ticket number links to it`() {
        #expect(Self.link(branch: "argo/#258-code-host") == .idInBranch(258))
    }

    @Test
    func `a hand-named branch with no pull request derives to unlinked`() {
        #expect(Self.link(branch: "hotfix") == .unlinked)
    }

    @Test
    func `an assertion links a branch that derived to unlinked`() {
        #expect(Self.link(branch: "hotfix", asserted: 31) == .asserted(31))
    }

    @Test
    func `an assertion never overrides the number the branch itself carries`() {
        #expect(Self.link(branch: "argo/#258-code-host", asserted: 31) == .idInBranch(258))
    }

    @Test
    func `an assertion never overrides the host's closing reference`() {
        let link = Self.link(branch: "hotfix", body: "Closes #258", asserted: 31)

        #expect(link == .native(258))
    }

    @Test
    func `an unlinked Delivery names no Ticket at all`() {
        #expect(Self.link(branch: "hotfix").number == nil)
    }
}
