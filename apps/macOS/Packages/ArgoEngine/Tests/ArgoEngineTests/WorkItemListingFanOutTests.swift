@testable import ArgoEngine
import Foundation
import Testing

/// How a listing reads the per-ticket edges: several tickets at once, bounded, and back in the
/// provider's own order.
///
/// The point of the fan-out is latency, which no assertion can see — so the suite asserts the two
/// things that make the latency safe to have.
@Suite("Work Item listing fan-out")
struct WorkItemListingFanOutTests {
    /// Enough tickets that the throttle has to harvest and re-add rather than start them all, and
    /// both edges on each: the cap counts TICKETS, so a ticket must not be able to spend two
    /// requests of it at once.
    private static let tickets = (1 ... 20).map {
        IssueJSON(number: $0, children: 1, blockers: 1)
    }

    private static func list(_ api: HeldEdges) async throws -> [WorkItem] {
        try await GitHubWorkItems(transport: api).list(in: "acme/api", grant: .listing)
    }

    @Test
    func `the edge fan-out peaks at the cap`() async throws {
        let api = HeldEdges(tickets: Self.tickets)
        _ = try await Self.list(api)

        // Exactly the cap, in requests: the gate holds each read open until that many are in
        // flight, and a ticket reads its two edges one after the other.
        #expect(await api.peak() == GitHubWorkItems.concurrentTickets)
    }

    @Test
    func `each ticket keeps the edges that answered about it`() async throws {
        let api = HeldEdges(tickets: Self.tickets)
        let items = try await Self.list(api)

        #expect(items.map(\.number) == Self.tickets.map(\.number))
        // The edges each ticket's own reads served. Cross-wiring survives the number assertion
        // above — these are what catch it.
        #expect(items.map(\.children) == Self.tickets.map { [HeldEdges.child(of: $0.number)] })
        #expect(
            items.map { $0.blockedBy?.map(\.number) }
                == Self.tickets.map { [HeldEdges.blocker(of: $0.number)] },
        )
    }
}

/// GitHub with both edge endpoints held open — each read waits until as many are in flight as the
/// port is willing to run, so the peak measured is the port's cap rather than whatever the
/// scheduler happened to overlap.
///
/// Bounded by a yield count and not a barrier, so a port that went back to reading one ticket at a
/// time fails the assertion instead of hanging the suite.
private actor HeldEdges: HTTPTransport {
    private let listing: String
    private var inFlight = 0
    private var highest = 0

    init(tickets: [IssueJSON]) {
        self.listing = IssueJSON.list(tickets)
    }

    /// What each of this ticket's two edges answers with — distinct per ticket and per edge, which
    /// is what makes a reply landing on the wrong ticket visible.
    static func child(of number: Int) -> Int {
        number * 100
    }

    static func blocker(of number: Int) -> Int {
        number * 100 + 1
    }

    private static let yields = 200

    func peak() -> Int {
        highest
    }

    func send(_ request: HTTPRequest) async throws -> Data {
        guard let edge = Edge(request.url) else { return Data(listing.utf8) }
        inFlight += 1
        highest = max(highest, inFlight)
        for _ in 0 ..< Self.yields where inFlight < GitHubWorkItems.concurrentTickets {
            await Task.yield()
        }
        inFlight -= 1
        return Data(IssueJSON.list([IssueJSON(number: edge.answer)]).utf8)
    }

    /// One edge read, by which endpoint it is and which ticket it is about.
    private struct Edge {
        let answer: Int

        /// `nil` for the listing itself, which is the only other path this suite's port asks for.
        init?(_ url: String) {
            guard let subject = url.split(separator: "/").last(where: { Int($0) != nil }),
                  let number = Int(subject)
            else { return nil }
            if url.contains("/sub_issues") {
                self.answer = HeldEdges.child(of: number)
            } else if url.contains("/blocked_by") {
                self.answer = HeldEdges.blocker(of: number)
            } else {
                return nil
            }
        }
    }
}
