@testable import ArgoEngine
import Foundation
import Testing

/// The pass that turns every `#<N>` on the roster into the words the code host holds, and writes
/// each one where the next launch will find it (#745).
@Suite("Work Item title resolver")
struct WorkItemTitleResolverTests {
    @Test
    func `every Session on a ticket branch is left holding that ticket's title`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let api = StubProviderAPI(body: #"{ "number": 745, "title": "Derive the link" }"#)

        let annotations = await Self.resolver(api, file)
            .resolve(links: ["chain-a": 745], through: Self.binding)

        #expect(annotations.ticketTitle("chain-a") == "Derive the link")
        // And on disk, so the next launch opens on the ticket's name rather than on `/implement`.
        #expect(await file.store().load().ticketTitle("chain-a") == "Derive the link")
    }

    @Test
    func `several Sessions on one ticket cost the code host one read`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let api = StubProviderAPI(body: #"{ "number": 745, "title": "Derive the link" }"#)

        // implement → code-review → pixel-review, all on the one branch.
        let annotations = await Self.resolver(api, file).resolve(
            links: ["chain-a": 745, "chain-b": 745, "chain-c": 745], through: Self.binding,
        )

        #expect(await api.urls().count == 1)
        #expect(annotations.ticketTitle("chain-b") == "Derive the link")
        #expect(annotations.ticketTitle("chain-c") == "Derive the link")
    }

    @Test
    func `a ticket already read this launch is not read again`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let api = StubProviderAPI(body: #"{ "number": 745, "title": "Derive the link" }"#)
        let resolver = Self.resolver(api, file)

        await resolver.resolve(links: ["chain-a": 745], through: Self.binding)
        // A second sweep, which is what every roster refresh amounts to.
        await resolver.resolve(links: ["chain-a": 745, "chain-b": 745], through: Self.binding)

        // One request per ticket per launch: a refresh per keystroke would be a request per
        // keystroke, and the persisted title already answers every read after the first.
        #expect(await api.urls().count == 1)
        #expect(await file.store().load().ticketTitle("chain-b") == "Derive the link")
    }

    @Test
    func `a ticket the host has nothing behind retires the title Argo was holding`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        await file.store().setTicketTitle("A ticket since deleted", sessionID: "chain-a")
        let api = StubProviderAPI(body: #"{ "message": "Not Found" }"#)

        let annotations = await Self.resolver(api, file)
            .resolve(links: ["chain-a": 745], through: Self.binding)

        // Degrade-down to no link rather than to a guess (`CONTEXT.md`, "Honesty tier").
        #expect(annotations.ticketTitle("chain-a") == nil)
    }

    @Test
    func `a code host that cannot be reached leaves every title where it was`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        await file.store().setTicketTitle("Derive the link", sessionID: "chain-a")
        let api = StubProviderAPI(failure: .status(code: 503))

        let annotations = await Self.resolver(api, file)
            .resolve(links: ["chain-a": 745], through: Self.binding)

        // An outage is not an answer, so the roster reads through it on what it already had.
        #expect(annotations.ticketTitle("chain-a") == "Derive the link")
    }

    @Test
    func `a Session the user renamed keeps its name through a resolve`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        await file.store().setName("Tonight's run", sessionID: "chain-a")
        let api = StubProviderAPI(body: #"{ "number": 745, "title": "Derive the link" }"#)

        let annotations = await Self.resolver(api, file)
            .resolve(links: ["chain-a": 745], through: Self.binding)

        // Argo writes one rung and the user writes the other. A resolve that took the user's name
        // would undo a rename nobody asked to undo.
        #expect(annotations.explicitName("chain-a") == "Tonight's run")
        #expect(annotations.ticketTitle("chain-a") == "Derive the link")
    }

    @Test
    func `a roster with no ticket branch on it reads nothing at all`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let api = StubProviderAPI()

        await Self.resolver(api, file).resolve(links: [:], through: Self.binding)

        #expect(await api.urls().isEmpty)
    }

    private static let binding = ResolvedBinding(
        binding: ProjectBinding(port: .workItem, accountID: "github:1", scope: "milad/argo"),
        account: AccountRecord(provider: .github, providerAccountID: "1", displayName: "milad"),
        grant: AccountGrant(accessToken: "ghu_personal", scopes: ["repo"]),
    )

    private static func resolver(
        _ api: StubProviderAPI, _ file: AnnotationFile,
    )
        -> WorkItemTitleResolver {
        WorkItemTitleResolver(
            titles: GitHubWorkItemTitles(transport: api), annotations: file.store(),
        )
    }
}
