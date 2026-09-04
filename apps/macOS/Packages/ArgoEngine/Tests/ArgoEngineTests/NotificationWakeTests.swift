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
/// The fixture is a slice of the real file behind the ticket — the `/implement` prompt, the two
/// `Agent` launches with their async receipts, the `end_turn` that parked the run, the notification
/// that woke it, and the first call the agent then made — with only the long bodies clipped, the
/// paths neutralised, and the parent chain stitched back into the straight line the lifted records
/// form. It ends inside that Turn, where the transcript stood when the screenshot was taken.
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

    /// The other half of the ticket, on the same real records: the call the agent made after the
    /// wake is inside the open Turn, which is what puts it back on the roster row.
    @Test
    func `the calls after the wake are inside the Turn it re-opened`() async throws {
        let read = try await Fixture.events("notificationWake")
        let wake = try #require(read.firstIndex { event in
            guard case .turnResumed = event else { return false }
            return true
        })
        let called = try #require(read.lastIndex { event in
            guard case let .toolCall(call) = event else { return false }
            return call.name == "Bash"
        })

        #expect(called > wake)
        #expect(!read[wake...].contains { $0 == .turnEnded(.endTurn) })
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
        // Counted off the `origin` the CLI stamps a report with, not off the envelope: that
        // fixture's last prompt QUOTES the envelope, and a marker match would read it as a report.
        let notifications = try Fixture.lines("taskNotification")
            .count { $0.contains("task-notification\"}") }
        let read = try await wakes(in: Fixture.events("taskNotification"))

        // The fixture carries every shape the CLI writes one in, so the count is its own guard
        // against a match that quietly stopped finding any.
        #expect(notifications > 1)
        #expect(read.count == notifications)
    }

    /// The guard the turn END has carried since `TranscriptSubject`, mirrored: a delegate that
    /// backgrounds work of its own files its report as a SIDECHAIN record, and the Turn that report
    /// opens is the delegate's. Opened on the root, it would read a Session as working when nobody
    /// is — the false DIRECT degrade-down refuses.
    @Test
    func `a delegate's own report does not wake the Session's Turn`() async throws {
        var session = HubSession(observation: hubTestObservation(id: "delegated", events: []))
        session.liveness = .live
        for event in try await Fixture.events("sidechainNotification") {
            session.apply(event)
        }

        #expect(!session.signals.turnOpen)
        #expect(session.status == .idle)
    }

    /// Every stamped wake in a reading. `compactMap` drops an unstamped one, so a count off this is
    /// also the claim that the moment which clocks the Turn came through.
    private func wakes(in events: [TranscriptEvent]) -> [Int] {
        events.compactMap { event -> Int? in
            guard case let .turnResumed(atMs) = event else { return nil }
            return atMs
        }
    }
}
