import Foundation

// Following a file that is still being written: ONE file read from where it last stopped.
//
// Two hazards handled here rather than by the reader above: a record can be half-written when the
// watcher fires, so a trailing partial line is carried rather than parsed; and a file can be
// truncated or replaced under an open handle, which reads as a cursor past the end.

/// The read cursor over one transcript file. An actor because `drain` is called from a file-system
/// event handler and from the initial read, and both mutate the same carry buffer; the offset only
/// advances inside the actor, so overlapping drains still produce lines in order.
private actor FileCursor {
    private let handle: FileHandle
    private var carry = Data()
    /// Where `carry`'s first byte sits in the file. Advanced by exactly the bytes handed out, so a
    /// line's offset is the file's own and not the batch's.
    private var carryOffset = 0

    init?(url: URL) {
        guard let handle = try? FileHandle(forReadingFrom: url) else { return nil }
        self.handle = handle
    }

    /// Every complete line appended since the last drain, each with its place in the file.
    func drain() -> [TranscriptLine] {
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
            carryOffset = 0
        } else {
            try? handle.seek(toOffset: offset)
        }
    }

    /// Split what has accumulated on newlines, keeping the tail behind: the last element is only a
    /// line if the data ended on a newline, otherwise it is a record still being written.
    /// The offset is taken from the RAW parts, before any of them is turned into a `String`: a
    /// line that is not UTF-8 is still bytes the file counted, and dropping it from the tally would
    /// mis-address every picture after it.
    private func takeCompleteLines() -> [TranscriptLine] {
        var parts = carry.split(separator: UInt8(ascii: "\n"), omittingEmptySubsequences: false)
        guard parts.count > 1 else { return [] }
        let remainder = parts.removeLast()
        var offset = carryOffset
        var lines: [TranscriptLine] = []
        for part in parts {
            if let text = String(data: Data(part), encoding: .utf8) {
                lines.append(TranscriptLine(text: text, byteOffset: offset))
            }
            offset += part.count + 1
        }
        carry = Data(remainder)
        carryOffset = offset
        return lines
    }
}

/// Every line already in the file, then every line appended to it, in the batches the reads came
/// back in — until the caller stops listening.
///
/// The FIRST batch is everything the file already held, so a consumer can tell a reconstruction
/// from the news that follows it. Every read is yielded, empty ones included — an empty transcript
/// has a backfill too.
///
/// The stream does not finish on its own; cancelling the consuming task closes the file.
public func transcriptLines(at url: URL) -> AsyncStream<[TranscriptLine]> {
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
