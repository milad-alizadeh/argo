@testable import ArgoUI
import SwiftUI
import Testing

/// The way back out of a Subagent (#1013): the rail's own head entry, lit while the feed is the
/// Session's own reading and selecting back to it from anywhere.
///
/// The claims are about the WRITE, so the scope is a binding this suite can read back — `.constant`
/// swallows one, and a rail that only appeared to re-scope is the bug the ticket describes.
@Suite("Agents rail main entry")
@MainActor
struct AgentsRailMainEntryTests {
    @Test
    func `main is lit exactly while the feed is the session's own reading`() {
        #expect(FeedScope.session.isSession)
        #expect(!FeedScope.subagent(0).isSession)
    }

    @Test
    func `selecting main from a subagent scopes back to the session`() {
        let scope = Scope(.subagent(1))

        rail(scope).selectSession()

        #expect(scope.value == .session)
    }

    @Test
    func `selecting main while it is already lit leaves the session's reading up`() {
        let scope = Scope(.session)

        rail(scope).selectSession()

        #expect(scope.value == .session)
    }

    /// The gesture that was the only way back stays a way back — the ticket takes it off the
    /// critical path rather than out of the rail.
    @Test
    func `selecting the lit chip still scopes back to the session`() throws {
        let agent = try #require(agents.last)
        let scope = Scope(.subagent(agent.id))
        let select = try #require(rail(scope).select(agent))

        select()

        #expect(scope.value == .session)
    }

    @Test
    func `selecting a chip that is not lit scopes onto that agent`() throws {
        let scope = Scope(.session)
        let agent = try #require(agents.last)
        let select = try #require(rail(scope).select(agent))

        select()

        #expect(scope.value == .subagent(agent.id))
    }

    /// Degrade-down, unchanged by the head entry: a chip with no reading behind it is not a
    /// control, so the rail draws it and it does nothing.
    @Test
    func `a chip with no reading behind it is still not a control`() throws {
        let unread = FeedAgents.all(
            in: FeedProjection.rows(from: FeedFixture.handedOver()),
            of: .running,
        )
        let agent = try #require(unread.first)

        #expect(rail(Scope(.session)).select(agent) == nil)
    }

    // MARK: - Fixtures

    /// The one Subagent this suite has a reading of, and its one line.
    private static let read = "a-back"
    private static let said = "The fold holds."

    private var agents: [FeedAgent] {
        FeedAgents.all(
            in: FeedProjection.rows(from: FeedFixture.handedOver(subagent: Self.read)),
            of: .running,
        )
    }

    private func rail(_ scope: Scope) -> AgentsRailControl {
        AgentsRailControl(
            scope: scope.binding,
            isCollapsed: .constant(false),
            readings: FeedAgentReader(events: [Self.read: [.message(markdown: Self.said)]]),
        )
    }

    /// A scope held where the suite can read it back after the rail has written it.
    @MainActor private final class Scope {
        var value: FeedScope

        init(_ value: FeedScope) {
            self.value = value
        }

        var binding: Binding<FeedScope> {
            Binding(get: { self.value }, set: { self.value = $0 })
        }
    }
}
