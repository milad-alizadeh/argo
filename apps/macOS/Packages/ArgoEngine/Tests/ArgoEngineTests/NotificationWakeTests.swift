@testable import ArgoEngine
import Testing

/// A Turn a background agent's report started, and nobody typed (#1299).
///
/// The roster read three long Sessions as not running while they worked, and took their newest call
/// off the row with the status — `activity(of:in:)` only draws a call while the Session reads
/// `running`, which is the gate that keeps a ten-minute-old call from being painted as live. The
/// cause was one record: a `/implement` run fans out review agents, ends its Turn to wait for them,
/// and is woken by a `<task-notification>`. Nothing about that record was a prompt, so nothing
/// re-opened the Turn, and the row said `idle` for the thirteen minutes the agent then worked.
///
/// The fixture is a slice of the real file behind the ticket — the `/implement` prompt, the `Agent`
/// launch, its async receipt, the `end_turn` that parked the run, and the notification that woke it
/// — with only the long bodies clipped and the parent chain stitched back into the straight line
/// the lifted records form. It ENDS at the notification, because that is where the transcript stood
/// when the screenshot was taken: mid-run, with more to come.
@Suite("Notification wake")
struct NotificationWakeTests {
    /// The Session as it stood in the screenshot: the file folded to its last line, and a process
    /// the liveness poll can see — which is the half of `running` the record never carries.
    private func woken() async throws -> HubSession {
        var session = HubSession(observation: hubTestObservation(id: "woken", events: []))
        session.liveness = .live
        for event in try await Fixture.events("notificationWake") {
            session.apply(event)
        }
        return session
    }

    @Test
    func `a report the agent went back to work on re-opens the Turn`() async throws {
        let session = try await woken()

        #expect(session.signals.turnOpen)
    }

    /// The symptom the ticket was filed on, read where the roster reads it.
    @Test
    func `a Session woken by a report reads running`() async throws {
        let session = try await woken()

        #expect(session.status == .running)
        // DERIVED and not DIRECT: the whole reading is the transcript's, and the wake is one more
        // thing the record said.
        #expect(session.statusReading.tier == .derived)
    }

    /// The Turn the report re-opened is a Turn like any other, so the next boundary closes it.
    @Test
    func `the re-opened Turn still ends where the record says it did`() async throws {
        var session = try await woken()

        session.apply(.turnEnded(.endTurn))

        #expect(!session.signals.turnOpen)
        #expect(session.status == .idle)
    }

    /// Every report says the run is going again, joined to a call or not — read across the reader's
    /// own notification fixture, which carries eight of them in every shape the CLI writes.
    @Test
    func `every report wakes the Turn, ahead of what it says about the call`() async throws {
        // Counted off the records the CLI STAMPED as reports, not off the marker: that fixture's
        // last prompt quotes the envelope, and a text match would read it as a ninth report.
        let notifications = try Fixture.lines("taskNotification")
            .count { $0.contains("\"kind\": \"task-notification\"") }
        // Every one of them, and every one STAMPED: `compactMap` drops an unstamped wake, so the
        // count is the claim that the moment which clocks the Turn came through.
        let wakes = try await Fixture.events("taskNotification").compactMap { event -> Int? in
            guard case let .turnResumed(atMs) = event else { return nil }
            return atMs
        }

        #expect(notifications == 8)
        #expect(wakes.count == notifications)
    }
}
