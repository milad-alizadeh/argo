import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// Which Ticket a Session's BRANCH names (#745): the link is derived from the join key rather than
/// from the prompt, it stays derived through the whole projection, a resolved title fills its
/// words in, and a branch naming a ticket the host denies reads as unlinked rather than vanishing.
///
/// What the row is CALLED once a link exists is `SessionTicketTitleTests`. Every case here drives a
/// real Hub, because the branch only reaches the projection through one.
@Suite("Session branch ticket")
struct SessionBranchTicketTests {
    @Test
    @MainActor
    func `the branch a Session is on is what links it to its Ticket`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await Self.observe(hub, id: "linked", branch: "argo/#741-anchor-the-feed")

        let session = try #require(Self.projection(of: hub).sessions.first)

        // Derived from the join key and not from the prompt text, which is what makes it work for
        // an external Session too (`CONTEXT.md` L3).
        #expect(session.ticket.link?.number == 741)
        // DERIVED, and it stays that way through the whole projection: a number read off a branch
        // by convention must never reach a surface as one Argo was told (#894).
        #expect(session.ticket.link?.tier == .derived)
        // Nothing has resolved it, so the link carries no words yet.
        #expect(session.ticket.link?.title == nil)
    }

    @Test
    @MainActor
    func `the title Argo resolved for a ticket is the one the row draws`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await Self.observe(hub, id: "linked", branch: "argo/#741-anchor-the-feed")
        let file = Self.throwaway()
        defer { try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }

        let annotations = await SessionAnnotationStore(fileURL: file)
            .setTicket(.named("Anchor the feed"), sessionID: "linked")

        let session = try #require(Self.projection(of: hub, annotations: annotations)
            .sessions.first)
        #expect(SessionTitle.resolved(for: session) == "#741 — Anchor the feed")
    }

    @Test
    @MainActor
    func `a branch naming a ticket the host denies draws no link at all`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await Self.observe(hub, id: "linked", branch: "argo/#741-anchor-the-feed")
        let file = Self.throwaway()
        defer { try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }

        let annotations = await SessionAnnotationStore(fileURL: file)
            .setTicket(.absent, sessionID: "linked")

        // Asked, and there is nothing behind #741. Drawing `Issue #741` anyway would assert a Work
        // Item that does not exist (`CONTEXT.md`, "Honesty tier").
        let session = try #require(Self.projection(of: hub, annotations: annotations)
            .sessions.first)
        // Bound and unrecognised is a READING, not an absence (#894): the header says so rather
        // than dropping the row, which is what a reader repairs a branch off.
        #expect(session.ticket == .unlinked)
        #expect(SessionHeaderProjection.header(from: session).issue == .unlinked)
    }

    @Test
    @MainActor
    func `a Session on the main branch links to nothing`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await Self.observe(hub, id: "unlinked", branch: "main")

        let session = try #require(Self.projection(of: hub).sessions.first)

        #expect(session.ticket == .unlinked)
    }

    /// A location that is not the machine's own: a store pointed at Application Support would
    /// rename the Sessions of whoever ran the suite.
    private static func throwaway() -> URL {
        URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-ticket-title-\(UUID().uuidString)/sessions.json")
    }

    @MainActor
    private static func projection(
        of hub: Hub, annotations: SessionAnnotations = .empty,
    )
        -> CockpitPresentation {
        CockpitPresentation(
            projects: [], activeProjectID: nil, hub: hub,
            // Bound throughout: every case here is about which Ticket a branch names, and with no
            // provider bound the answer would be `unread` before the branch was ever read (#894).
            readings: .init(annotations: annotations, isTicketProviderBound: true),
        )
    }

    /// Drive one finished tail in and yield until the roster has read it — the observable end of a
    /// tail, which is the Hub's own task and is not handed back.
    @MainActor
    private static func observe(_ hub: Hub, id: String, branch: String) async {
        let stream = AsyncStream<[TranscriptEvent]> { continuation in
            continuation.yield([
                .cwd("/Users/milad/Developer/argo"),
                .branch(branch),
                .prompt(text: "/implement 741", images: [], atMs: nil),
                .turnEnded(.endTurn),
            ])
            continuation.finish()
        }
        await hub.startObserving(TranscriptObservation(
            id: id,
            sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
            events: stream,
        ))
        for _ in 0 ..< 200 where projection(of: hub).sessions.first?.status != .idle {
            await Task.yield()
        }
    }
}
