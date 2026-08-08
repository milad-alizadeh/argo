@testable import ArgoEngine
import Testing

@Suite("Session liveness")
struct SessionLivenessTests {
    private static let now = 1_700_000_000_000
    private static let window = SessionLiveness.recentActivityWindowMs

    private static func read(processMatch: Bool, wroteAgoMs: Int?) -> SessionLiveness {
        SessionLiveness.read(
            processMatch: processMatch,
            lastActivityAtMs: wroteAgoMs.map { now - $0 },
            nowMs: now,
        )
    }

    @Test
    func `a matched process writing recently is live`() {
        #expect(Self.read(processMatch: true, wroteAgoMs: 0) == .live)
        #expect(Self.read(processMatch: true, wroteAgoMs: Self.window) == .live)
    }

    @Test
    func `a match whose record has gone quiet is not live`() {
        // The long-think case read down: the process is there, but nothing says it is this
        // Session's, and mtime is the only corroboration on offer.
        #expect(Self.read(processMatch: true, wroteAgoMs: Self.window + 1) == .quiet)
    }

    @Test
    func `a recent write with no process behind it is not live`() {
        #expect(Self.read(processMatch: false, wroteAgoMs: 0) == .quiet)
    }

    @Test
    func `a Session that never reported a time is not live`() {
        // A record with no timestamp is not a Session that ran at the epoch, and it is not one
        // running now either.
        #expect(Self.read(processMatch: true, wroteAgoMs: nil) == .quiet)
    }
}
