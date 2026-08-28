@testable import ArgoEngine
import Foundation
import Testing

/// The pass that turns every `#<N>` on the roster into the words the code host holds, and writes
/// each one where the next launch will find it (#745).
@Suite("Ticket title resolver")
struct TicketTitleResolverTests {
    @Test
    func `every Session on a ticket branch is left holding that ticket's title`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let api = StubProviderAPI(body: Self.named)

        let annotations = await Self.resolver(api, file)
            .resolve(links: ["chain-a": 745], through: Self.gitHub)

        #expect(annotations.ticket("chain-a") == .named("Derive the link"))
        // And on disk, so the next launch opens on the ticket's name rather than on `/implement`.
        #expect(await file.store().load().ticket("chain-a") == .named("Derive the link"))
    }

    @Test
    func `several Sessions on one ticket cost the code host one read`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let api = StubProviderAPI(body: Self.named)

        // implement → code-review → pixel-review, all on the one branch.
        let annotations = await Self.resolver(api, file).resolve(
            links: ["chain-a": 745, "chain-b": 745, "chain-c": 745], through: Self.gitHub,
        )

        #expect(await api.urls().count == 1)
        #expect(annotations.ticket("chain-b") == .named("Derive the link"))
        #expect(annotations.ticket("chain-c") == .named("Derive the link"))
    }

    @Test
    func `a ticket already settled this launch is not read again`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let api = StubProviderAPI(body: Self.named)
        let resolver = Self.resolver(api, file)

        await resolver.resolve(links: ["chain-a": 745], through: Self.gitHub)
        // A second sweep, which is what every roster change amounts to.
        await resolver.resolve(links: ["chain-a": 745, "chain-b": 745], through: Self.gitHub)

        #expect(await api.urls().count == 1)
        #expect(await file.store().load().ticket("chain-b") == .named("Derive the link"))
    }

    @Test
    func `a ticket that established nothing is asked again on the next sweep`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let api = StubProviderAPI(failure: .status(code: 503))
        let resolver = Self.resolver(api, file)

        await resolver.resolve(links: ["chain-a": 745], through: Self.gitHub)
        await resolver.resolve(links: ["chain-a": 745], through: Self.gitHub)

        // Only a settled answer is remembered. One offline moment at launch must not cost that
        // ticket its name for the rest of the launch.
        #expect(await api.urls().count == 2)
    }

    @Test
    func `a ticket the host has nothing behind retires the link Argo was holding`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        await file.store().setTicket(.named("A ticket since deleted"), sessionID: "chain-a")
        let api = StubProviderAPI(body: #"{ "message": "Not Found" }"#)

        let annotations = await Self.resolver(api, file)
            .resolve(links: ["chain-a": 745], through: Self.gitHub)

        // Degrade-down to no link rather than to a guess (`CONTEXT.md`, "Honesty tier").
        #expect(annotations.ticket("chain-a") == .absent)
    }

    @Test
    func `a code host that cannot be reached leaves every title where it was`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        await file.store().setTicket(.named("Derive the link"), sessionID: "chain-a")
        let api = StubProviderAPI(failure: .status(code: 503))

        let annotations = await Self.resolver(api, file)
            .resolve(links: ["chain-a": 745], through: Self.gitHub)

        // An outage is not an answer, so the roster reads through it on what it already had.
        #expect(annotations.ticket("chain-a") == .named("Derive the link"))
    }

    @Test
    func `a Session the user renamed keeps its name through a resolve`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        await file.store().setName("Tonight's run", sessionID: "chain-a")
        let api = StubProviderAPI(body: Self.named)

        let annotations = await Self.resolver(api, file)
            .resolve(links: ["chain-a": 745], through: Self.gitHub)

        // Argo writes one rung and the user writes the other. A resolve that took the user's name
        // would undo a rename nobody asked to undo.
        #expect(annotations.explicitName("chain-a") == "Tonight's run")
        #expect(annotations.ticket("chain-a") == .named("Derive the link"))
    }

    @Test
    func `a Ticket port bound to Linear is read through Linear, never GitHub`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let api = StubProviderAPI(body: Self.linearNamed)

        let annotations = await Self.resolver(api, file)
            .resolve(links: ["chain-a": 745], through: Self.linear)

        // Linear fills the Ticket port (`AccountProvider.ports`) and now has an adapter (#371).
        // The wrong answer is a Linear grant reaching `api.github.com`, which the resolver's
        // exhaustive switch is what rules out.
        #expect(await api.urls() == [LinearAPI.endpoint])
        #expect(annotations.ticket("chain-a") == .named("Derive the link"))
    }

    @Test
    func `a roster with no ticket branch on it reads nothing at all`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let api = StubProviderAPI()

        await Self.resolver(api, file).resolve(links: [:], through: Self.gitHub)

        #expect(await api.urls().isEmpty)
    }

    private static let named = #"{ "number": 745, "title": "Derive the link" }"#
    private static let linearNamed = """
    { "data": { "team": { "issues": { "nodes": [{ "title": "Derive the link" }] } } } }
    """

    private static let gitHub = binding(provider: .github, scope: "milad/argo")
    private static let linear = binding(provider: .linear, scope: "team-argo")

    private static func binding(provider: AccountProvider, scope: String) -> ResolvedBinding {
        ResolvedBinding(
            binding: ProjectBinding(
                port: .ticket, accountID: "\(provider.rawValue):1", scope: scope,
            ),
            account: AccountRecord(
                provider: provider, providerAccountID: "1", displayName: "milad",
            ),
            grant: AccountGrant(accessToken: "ghu_personal", scopes: ["repo"]),
        )
    }

    private static func resolver(
        _ api: StubProviderAPI, _ file: AnnotationFile,
    )
        -> TicketTitleResolver {
        TicketTitleResolver(
            titles: TicketTitleAdapters(transport: api), annotations: file.store(),
        )
    }
}
