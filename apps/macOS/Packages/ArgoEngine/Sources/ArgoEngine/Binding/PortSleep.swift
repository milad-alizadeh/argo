import Foundation

/// The wait a repeating read paces itself with.
enum PortSleep {
    /// `false` once the wait was cancelled, which is the only exit a repeating read has besides
    /// being stopped. Shared by the poll and the socket, so a cancellation ends both alike.
    static func uncancelled(
        _ sleep: PortPollLoop.Sleeper, for interval: Duration,
    ) async
        -> Bool {
        await (try? sleep(interval)) != nil
    }
}
