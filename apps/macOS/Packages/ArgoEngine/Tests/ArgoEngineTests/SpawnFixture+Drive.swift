@testable import ArgoEngine
import Testing

/// Typing at a spawned Session for the suites that assert on the KEYSTROKES it produced.
///
/// `hub.driver.send` does two things: it types the Turn, and it arms the delivery watch (#682),
/// which types a Return of its OWN once the Session has written no record for three seconds. The
/// CLI here is a `FakeProcessHost`, which writes no record ever, so that silence never ends and
/// both retries are certain — four writes at about 300 ms, a fifth at 3 s, a sixth at 7 s (#1040).
extension SpawnFixture {
    /// One Turn typed at a Session's prompt, with the delivery watch dropped behind it.
    func typeTurn(_ text: String, to sessionID: String) throws {
        try hub.driver.send(text, to: sessionID)
        dropTurnWatch(on: sessionID)
    }

    func dropTurnWatch(on sessionID: String) {
        hub.delivery.forget(sessionID)
    }

    /// What the most recent spawn's PTY has taken, once `count` keystrokes have reached it — and
    /// an assertion that no more than that ever did.
    ///
    /// The wait counts UPWARDS while the assertion is exact, because the two answer different
    /// hazards: a reader the machine held back cannot miss a rising count the way it misses an
    /// equality that has already gone past, and a keystroke nobody named still has to fail.
    func keystrokes(
        exactly count: Int,
        at location: SourceLocation = #_sourceLocation,
    ) async
        -> [String] {
        await settle(
            until: { (host.started.last?.written.count ?? 0) >= count },
            message: "fewer than \(count) keystrokes reached the PTY",
            at: location,
        )
        let typed = host.started.last?.written ?? []
        #expect(
            typed.count == count,
            "keystrokes besides the \(count) expected",
            sourceLocation: location,
        )
        return typed
    }
}
