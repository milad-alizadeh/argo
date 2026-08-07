import Foundation
import Synchronization

/// Wakes when anything under a CLI's record directory changes.
///
/// `FSEventStream` rather than the per-file `DispatchSource` the tails use, because the thing being
/// watched for does not exist yet: a Session started while Argo is running is a new file, in a
/// project directory that may itself be new. Only a recursive watch on the root sees either appear.
struct RecordDirectoryWatcher: Sendable {
    /// A working agent writes many records a second and every one of them is a directory change.
    /// Coalescing turns a burst into one sweep, which is the difference between a quiet observer
    /// and a busy loop on a laptop.
    static let coalesceInterval: TimeInterval = 1

    let rootURL: URL

    /// One element per burst of changes, until the caller stops listening. Never finishes on its
    /// own: a record directory has no end, the same way a live transcript has none.
    func changes() -> AsyncStream<Void> {
        AsyncStream { continuation in
            let sink = ChangeSink { continuation.yield(()) }
            guard sink.start(watching: rootURL) else {
                continuation.finish()
                return
            }
            // Capturing the sink is what keeps it alive: the C callback holds an UNRETAINED
            // pointer to it, so the last strong reference has to outlive the stream it feeds.
            continuation.onTermination = { _ in sink.stop() }
        }
    }
}

/// The bridge across the C callback, which captures nothing and can only be handed an opaque
/// pointer.
///
/// The stream handle lives behind a `Mutex` rather than in a `var`, because the two things that
/// touch it — the start on the caller's thread and the stop from the stream's termination handler —
/// are not the same thread, and `FSEventStreamRef` is a raw pointer the concurrency checker cannot
/// reason about on its own.
private final class ChangeSink: Sendable {
    private let yield: @Sendable () -> Void
    private let stream = Mutex<FSEventStreamRef?>(nil)

    init(yield: @escaping @Sendable () -> Void) {
        self.yield = yield
    }

    func changed() {
        yield()
    }

    /// The handle is created INSIDE the lock and never leaves it. A stream made outside and then
    /// stored would be a raw pointer crossing an isolation boundary, which is the thing the mutex
    /// exists to avoid rather than to annotate away.
    func start(watching rootURL: URL) -> Bool {
        stream.withLock { handle in
            var context = FSEventStreamContext(
                version: 0,
                info: Unmanaged.passUnretained(self).toOpaque(),
                retain: nil,
                release: nil,
                copyDescription: nil,
            )
            guard let created = FSEventStreamCreate(
                nil,
                onRecordDirectoryChange,
                &context,
                [rootURL.path] as CFArray,
                FSEventStreamEventId(kFSEventStreamEventIdSinceNow),
                RecordDirectoryWatcher.coalesceInterval,
                UInt32(kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagNoDefer),
            ) else { return false }
            FSEventStreamSetDispatchQueue(created, DispatchQueue(label: Self.queueLabel))
            FSEventStreamStart(created)
            handle = created
            return true
        }
    }

    /// Stopping before invalidating is what makes the unretained pointer safe: no further callback
    /// can be delivered once this returns, so the sink may be released after it.
    func stop() {
        stream.withLock { handle in
            guard let live = handle else { return }
            FSEventStreamStop(live)
            FSEventStreamInvalidate(live)
            FSEventStreamRelease(live)
            handle = nil
        }
    }

    private static let queueLabel = "dev.milad.argo.record-directory"
}

/// Which paths moved is deliberately unread. The sweep is what decides the working set, and it is
/// cheap enough that answering "something changed" with "sweep again" costs less than keeping a
/// second, subtly different filter here.
private let onRecordDirectoryChange: FSEventStreamCallback = { _, info, _, _, _, _ in
    guard let info else { return }
    Unmanaged<ChangeSink>.fromOpaque(info).takeUnretainedValue().changed()
}
