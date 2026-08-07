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
    ///
    /// Buffered at one, because the element is `Void`. Every yield means the same thing — sweep
    /// again — and a sweep that runs longer than the coalesce interval would otherwise queue a
    /// backlog of identical, already-stale wake-ups it could never catch up on.
    func changes() -> AsyncStream<Void> {
        AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            let sink = ChangeSink { continuation.yield(()) }
            guard sink.start(watching: Self.watchable(from: rootURL)) else {
                continuation.finish()
                return
            }
            continuation.onTermination = { _ in sink.stop() }
        }
    }

    /// The nearest ancestor that exists.
    ///
    /// `FSEventStreamCreate` accepts a path that is not there and then never reports it appearing,
    /// so a machine that has never run the CLI would watch nothing and stay that way until Argo was
    /// relaunched. Watching the nearest real ancestor sees the record directory being created.
    /// Every event still costs only a sweep, and the sweep is bounded by the real root.
    private static func watchable(from url: URL) -> URL {
        var candidate = url.standardizedFileURL
        while !FileManager.default.fileExists(atPath: candidate.path),
              candidate.pathComponents.count > 1 {
            candidate = candidate.deletingLastPathComponent()
        }
        return candidate
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
    ///
    /// The sink is handed over RETAINED, with the matching release given to FSEvents as the
    /// context's own callback. That is what makes the unretained read in the C callback safe: the
    /// stream holds a reference for exactly as long as it can still deliver, and drops it after
    /// invalidation rather than at whatever moment the consumer stopped listening.
    func start(watching rootURL: URL) -> Bool {
        stream.withLock { handle in
            var context = FSEventStreamContext(
                version: 0,
                info: Unmanaged.passRetained(self).toOpaque(),
                retain: nil,
                release: releaseChangeSink,
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
            // A start that fails is a watch that would report nothing forever while claiming to be
            // live. Releasing here says so, and the caller finishes the stream instead.
            guard FSEventStreamStart(created) else {
                FSEventStreamInvalidate(created)
                FSEventStreamRelease(created)
                return false
            }
            handle = created
            return true
        }
    }

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

/// FSEvents' own release of the context, called after the stream is invalidated and no further
/// callback can be delivered.
private let releaseChangeSink: CFAllocatorReleaseCallBack = { info in
    guard let info else { return }
    Unmanaged<ChangeSink>.fromOpaque(info).release()
}
