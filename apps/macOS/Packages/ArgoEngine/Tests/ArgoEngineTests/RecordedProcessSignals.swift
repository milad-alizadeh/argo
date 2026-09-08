import Synchronization

/// Signals captured across the sendable process boundary used by spawn and end tests.
final class RecordedProcessSignals: Sendable {
    private let storage = Mutex<[Int32]>([])

    var values: [Int32] {
        storage.withLock { $0 }
    }

    func record(_ pid: Int32) -> Bool {
        storage.withLock { $0.append(pid) }
        return true
    }
}
