@testable import ArgoEngine
import Foundation
import Testing

/// Filing a ticket end to end (#872): resolve the Project's Binding, write through the adapter that
/// speaks its provider, and answer with the refusal that stopped it.
@Suite("Work Item creator")
struct WorkItemCreatorTests {
    private static let draft = WorkItemDraft(title: "Wire the verbs", body: "Prose.")

    private static func creator(
        _ fixture: BindingFixture, api: StubProviderAPI, items: WorkItemLedger,
    )
        -> WorkItemCreator {
        WorkItemCreator(
            bindings: fixture.bindings(),
            items: items,
            health: ConnectionHealthLedger(),
            writes: ProviderWorkItemWrites(transport: api),
        )
    }

    /// A landed create answers nothing, and the provider's own copy of the ticket is in the ledger
    /// the room draws from — which is what puts it in the backlog without waiting for a poll tick.
    @Test func `a filed ticket lands in the listing the room draws from`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeGitHub(id: "1")
        try await fixture.bindings().bind(.gitHub(), to: projectID)
        let items = WorkItemLedger()
        let api = StubProviderAPI(body: IssueJSON(number: 872, title: "Wire the verbs").json)

        let refusal = await Self.creator(fixture, api: api, items: items)
            .create(Self.draft, forProject: projectID)

        #expect(refusal == nil)
        #expect(await items.items(of: projectID).map(\.number) == [872])
        #expect(await api.urls().contains { $0.hasSuffix("/repos/milad-alizadeh/argo/issues") })
    }

    /// The provider's own sentence reaches the caller unedited, so the composer can put GitHub's
    /// words beside the button rather than one of Argo's about a decision GitHub made.
    @Test func `a refused write answers in the provider's own words`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        try await fixture.accountStore().authorizeGitHub(id: "1")
        try await fixture.bindings().bind(.gitHub(), to: projectID)
        let items = WorkItemLedger()
        let api = StubProviderAPI(
            body: #"{"message": "Issues are disabled for this repository."}"#,
        )

        let refusal = await Self.creator(fixture, api: api, items: items)
            .create(Self.draft, forProject: projectID)

        #expect(refusal == .refused("Issues are disabled for this repository."))
        // Nothing was filed, so nothing enters the listing — a room that showed the ticket anyway
        // would be painting a state the provider never confirmed.
        #expect(await items.items(of: projectID).isEmpty)
    }

    /// Not reachable from the room — the control is drawn off the same resolve — but a write with
    /// nowhere to land says so rather than appearing to have worked.
    @Test func `a Project with no Work Item Binding has nowhere to file`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let projectID = try await fixture.project("argo")
        let api = StubProviderAPI()

        let refusal = await Self.creator(fixture, api: api, items: WorkItemLedger())
            .create(Self.draft, forProject: projectID)

        #expect(refusal == .unreachable(.unreachable))
        #expect(await api.urls().isEmpty)
    }

    @Test func `a window on no Project has nowhere to file either`() async throws {
        let fixture = try BindingFixture()
        defer { fixture.remove() }
        let api = StubProviderAPI()

        let refusal = await Self.creator(fixture, api: api, items: WorkItemLedger())
            .create(Self.draft, forProject: nil)

        #expect(refusal == .unreachable(.unreachable))
        #expect(await api.urls().isEmpty)
    }
}
