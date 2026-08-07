import Foundation

// Following a file that is still being written. The Electron reader watches the transcript ROOT and
// re-reads whole files on a debounce; this follows ONE file from where it last stopped, which is
// what makes the output a stream rather than a repeated snapshot.
//
// Two hazards the whole-file re-read never had, and both are handled here rather than by the
// reader above: a record can be half-written when the watcher fires, so a trailing partial line is
// carried rather than parsed; and a file can be truncated or replaced under an open handle, which
// reads as a cursor past the end and is answered by starting over.

/// The read cursor over one transcript file.
///
/// An actor because the drain is called from a file-system event handler and from the initial read,
/// and both mutate the same carry buffer. Two drains overlapping still produce lines in order: the
/// offset only ever advances inside the actor, so whichever runs second reads what the first left.
private actor FileCursor {
    private let handle: FileHandle
    private var carry = Data()

    init?(url: URL) {
        guard let handle = try? FileHandle(forReadingFrom: url) else { return nil }
        self.handle = handle
    }

    /// Every complete line appended since the last drain.
    func drain() -> [String] {
        rewindIfTruncated()
        guard let chunk = try? handle.readToEnd(), !chunk.isEmpty else { return [] }
        carry.append(chunk)
        return takeCompleteLines()
    }

    func close() {
        try? handle.close()
    }

    /// A file shorter than where we are reading was replaced or emptied. Anything carried belongs
    /// to a file that no longer exists, so it goes with it.
    private func rewindIfTruncated() {
        // The cursor is read BEFORE seeking to the end, because seeking IS what moves it: asking
        // afterwards answers with the end every time, and the read that follows finds nothing.
        guard let offset = try? handle.offset(), let end = try? handle.seekToEnd() else { return }
        if end < offset {
            try? handle.seek(toOffset: 0)
            carry.removeAll()
        } else {
            try? handle.seek(toOffset: offset)
        }
    }

    /// Split what has accumulated on newlines, keeping the tail behind.
    ///
    /// The last element is only a line if the data ended on a newline. Otherwise it is a record the
    /// agent is still writing, and parsing it would report a malformed line for a file that is
    /// perfectly well-formed a millisecond later.
    private func takeCompleteLines() -> [String] {
        var parts = carry.split(separator: UInt8(ascii: "\n"), omittingEmptySubsequences: false)
        guard parts.count > 1 else { return [] }
        let remainder = parts.removeLast()
        carry = Data(remainder)
        return parts.compactMap { String(data: Data($0), encoding: .utf8) }
    }
}

/// Every line already in the file, then every line appended to it, in the batches the reads came
/// back in — until the caller stops listening.
///
/// Batched rather than yielded one line at a time, because the batch boundary is itself a fact: the
/// FIRST element is everything the file already held, so a consumer can tell a reconstruction from
/// the news that follows it. Every read is yielded, empty ones included — an empty transcript has
/// a backfill too, and a consumer waiting to be told the file has been read would otherwise wait
/// forever.
///
/// The stream does not finish on its own: a live transcript has no end, and an agent that has been
/// quiet for an hour is idle rather than over. Cancelling the consuming task closes the file.
public func transcriptLines(at url: URL) -> AsyncStream<[String]> {
    AsyncStream { continuation in
        guard let cursor = FileCursor(url: url) else {
            continuation.finish()
            return
        }
        let watcher = FileWatcher(url: url) {
            let lines = await cursor.drain()
            continuation.yield(lines)
        }
        continuation.onTermination = { _ in
            watcher.cancel()
            Task { await cursor.close() }
        }
        watcher.start()
    }
}

/// Wakes on every write to one file.
///
/// `.extend` is the append an agent makes; `.write` covers a host that rewrites in place; `.delete`
/// and `.rename` are how a file is replaced rather than appended to, and are worth waking for so
/// the cursor discovers the truncation on its next drain rather than going quiet forever.
private final class FileWatcher: Sendable {
    private let source: any DispatchSourceFileSystemObject
    private let onChange: @Sendable () async -> Void

    init(url: URL, onChange: @escaping @Sendable () async -> Void) {
        let descriptor = open(url.path, O_EVTONLY)
        self.onChange = onChange
        self.source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: descriptor,
            eventMask: [.extend, .write, .delete, .rename],
            queue: DispatchQueue(label: "dev.milad.argo.transcript-tail"),
        )
        source.setEventHandler { Task { await onChange() } }
        source.setCancelHandler { close(descriptor) }
    }

    /// Activate, then drain once unprompted: the events only report what happens NEXT, so a file
    /// that is never written to again would otherwise never be read at all.
    func start() {
        source.activate()
        Task { await onChange() }
    }

    func cancel() {
        source.cancel()
    }
}
