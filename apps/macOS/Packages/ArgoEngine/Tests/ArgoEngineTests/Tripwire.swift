import Observation
import Synchronization

/// Whether an observed read was invalidated. Tripped from inside `onChange`, which runs on the
/// mutating side before the write lands — so the flag is what is asserted, never the value. Behind
/// a `Mutex` because the callback is `@Sendable` and the checker will not take our word for where
/// it runs.
final class Tripwire: Sendable {
    private let flag = Mutex(false)

    var fired: Bool {
        flag.withLock { $0 }
    }

    /// Read something observable, and hand back the wire that says whether it was invalidated.
    static func watching(_ read: () -> Void) -> Tripwire {
        let tripwire = Tripwire()
        withObservationTracking(read) { tripwire.trip() }
        return tripwire
    }

    private func trip() {
        flag.withLock { $0 = true }
    }
}
