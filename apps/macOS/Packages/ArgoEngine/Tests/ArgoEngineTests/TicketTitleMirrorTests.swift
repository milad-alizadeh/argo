@testable import ArgoEngine
import Foundation
import Testing

/// What a settled Ticket title does besides landing in the annotation file (#1494).
@Suite("Ticket title mirror")
struct TicketTitleMirrorTests {
    @Test
    func `a Ticket title that settles is mirrored onto the Session it named`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let mirrored = Mirrored()

        await Self.resolver(StubProviderAPI(body: Self.named), file, mirrored)
            .resolve(links: ["chain-a": 745], through: Self.gitHub)

        #expect(await mirrored.calls()
            == [Mirrored.Call(title: "Derive the link", sessionID: "chain-a")])
    }

    /// The resolve pass runs whenever an untitled number appears on the roster, so a mirror per
    /// pass would retype `/rename` at a Session that has been sitting on the right name for hours.
    @Test
    func `a title that has not changed is mirrored once and never again`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let mirrored = Mirrored()
        let resolver = Self.resolver(StubProviderAPI(body: Self.named), file, mirrored)

        await resolver.resolve(links: ["chain-a": 745], through: Self.gitHub)
        await resolver.resolve(links: ["chain-a": 745], through: Self.gitHub)

        #expect(await mirrored.calls().count == 1)
    }

    /// The refusal is the ordinary case — a Turn in flight, a pending Permission, a question — and
    /// it must not be permanent: a Session whose prompt was busy for the one sweep that had news
    /// for it would keep the CLI's generated name for the rest of the launch.
    @Test
    func `a title the prompt could not take this sweep is offered again on the next`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let mirrored = Mirrored(takes: false)
        let resolver = Self.resolver(StubProviderAPI(body: Self.named), file, mirrored)

        await resolver.resolve(links: ["chain-a": 745], through: Self.gitHub)
        await mirrored.nowTakes(true)
        await resolver.resolve(links: ["chain-a": 745], through: Self.gitHub)
        // And once it has landed, it stops being offered.
        await resolver.resolve(links: ["chain-a": 745], through: Self.gitHub)

        #expect(await mirrored.calls().count == 2)
    }

    /// The user's name is what the roster draws, so mirroring the ticket over it would put Argo and
    /// the CLI on two different titles — the disagreement this whole ticket exists to end.
    @Test
    func `a Session the user named mirrors no ticket title over their name`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        await file.store().setName("Tonight's run", sessionID: "chain-a")
        let mirrored = Mirrored()

        let annotations = await Self.resolver(StubProviderAPI(body: Self.named), file, mirrored)
            .resolve(links: ["chain-a": 745], through: Self.gitHub)

        // Held all the same: the name is the user's and the reading is Argo's, and the roster's
        // fallback chain is what decides between them (#745).
        #expect(annotations.ticket("chain-a") == .named("Derive the link"))
        #expect(await mirrored.calls().isEmpty)
    }

    /// A branch naming a ticket that does not exist. There are no words, so there is nothing to
    /// say — and least of all the CLI's own generated name written back over itself.
    @Test
    func `a ticket the host has nothing behind mirrors nothing`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        let mirrored = Mirrored()

        await Self.resolver(StubProviderAPI(body: #"{ "message": "Not Found" }"#), file, mirrored)
            .resolve(links: ["chain-a": 745], through: Self.gitHub)

        #expect(await mirrored.calls().isEmpty)
    }

    /// An outage establishes nothing, so it writes nothing and types nothing: the Session keeps
    /// whatever name it already had on both sides.
    @Test
    func `a code host that cannot be reached mirrors nothing`() async {
        let file = AnnotationFile()
        defer { file.remove() }
        await file.store().setTicket(.named("Derive the link"), sessionID: "chain-a")
        let mirrored = Mirrored()

        await Self.resolver(StubProviderAPI(failure: .status(code: 503)), file, mirrored)
            .resolve(links: ["chain-a": 745], through: Self.gitHub)

        #expect(await mirrored.calls().isEmpty)
    }

    /// What the mirror was handed, in order — and the COUNT as much as the words, because a mirror
    /// that fired twice for one resolve is the thing these claims are watching for.
    private actor Mirrored {
        struct Call: Equatable {
            let title: String
            let sessionID: String
        }

        /// What the next call answers. `false` stands for every prompt that could not take the
        /// line — a Turn in flight, a pending Permission, a `codex` Session.
        private var takes = true
        private var recorded: [Call] = []

        init(takes: Bool = true) {
            self.takes = takes
        }

        func calls() -> [Call] {
            recorded
        }

        func nowTakes(_ takes: Bool) {
            self.takes = takes
        }

        func record(_ title: String, to sessionID: String) -> Bool {
            recorded.append(Call(title: title, sessionID: sessionID))
            return takes
        }
    }

    private static let named = #"{ "number": 745, "title": "Derive the link" }"#

    private static let gitHub = ResolvedBinding(
        binding: ProjectBinding(port: .ticket, accountID: "github:1", scope: "milad/argo"),
        account: AccountRecord(
            provider: .github, providerAccountID: "1", displayName: "milad",
        ),
        grant: AccountGrant(accessToken: "ghu_personal", scopes: ["repo"]),
    )

    private static func resolver(
        _ api: StubProviderAPI, _ file: AnnotationFile, _ mirrored: Mirrored,
    )
        -> TicketTitleResolver {
        TicketTitleResolver(
            titles: TicketTitleAdapters(transport: api),
            annotations: file.store(),
            mirror: TicketTitleMirror { title, sessionID in
                await mirrored.record(title, to: sessionID)
            },
        )
    }
}
