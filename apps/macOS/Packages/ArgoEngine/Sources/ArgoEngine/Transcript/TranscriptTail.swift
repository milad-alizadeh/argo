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
    /// How much of each end the FIRST drain reads, or nothing to read the file whole from its
    /// start. Cleared once taken, so everything after the opening read is an ordinary tail either
    /// way — see `TranscriptExcerpt`.
    private var excerptSideLimit: Int?

    init?(url: URL, excerptSideLimit: Int? = nil) {
        guard let handle = try? FileHandle(forReadingFrom: url) else { return nil }
        self.handle = handle
        self.excerptSideLimit = excerptSideLimit
    }

    /// Every complete line appended since the last drain, each with its place in the file.
    func drain() -> [TranscriptLine] {
        if let sideLimit = excerptSideLimit {
            excerptSideLimit = nil
            return excerpt(sideLimit: sideLimit)
        }
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

    /// The bounded opening read, with the cursor left at its end: everything appended after this
    /// moment arrives as an ordinary tail, so a row that is excerpted still goes live.
    private func excerpt(sideLimit: Int) -> [TranscriptLine] {
        guard let excerpt = TranscriptExcerpt(reading: handle, sideLimit: sideLimit) else {
            return []
        }
        carry = Data()
        carryOffset = excerpt.endOffset
        try? handle.seek(toOffset: UInt64(excerpt.endOffset))
        return excerpt.lines
    }

    /// Split what has accumulated on newlines, keeping the record still being written behind —
    /// `TranscriptLineSplit`, which the excerpt above cuts on too.
    private func takeCompleteLines() -> [TranscriptLine] {
        let split = TranscriptLineSplit(of: carry, at: carryOffset)
        carry = split.remainder
        carryOffset = split.remainderOffset
        return split.lines
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
public func transcriptLines(
    at url: URL,
    excerptSideLimit: Int? = nil,
)
    -> AsyncStream<[TranscriptLine]> {
    AsyncStream { continuation in
        guard let cursor = FileCursor(url: url, excerptSideLimit: excerptSideLimit) else {
            continuation.finish()
            return
        }
        let watcher = FileWatcher(url: url) {
            let lines = await cursor.drain()
            continuation.yield(lines)
        }
        guard let watcher else {
            Task { await cursor.close() }
            continuation.finish()
            return
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

    /// `nil` where the file could not be opened for events, the same refusal `FileCursor` makes
    /// of the same path: a descriptor that failed to open is `-1`, and handing that to a source
    /// arms a cancel handler that closes a number this process never had.
    init?(url: URL, onChange: @escaping @Sendable () async -> Void) {
        let descriptor = open(url.path, O_EVTONLY)
        guard descriptor >= 0 else { return nil }
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

    /// The half of the lifetime no caller spells. An activated source is retained by GCD, so a
    /// watcher dropped without a `cancel` holds its descriptor for the life of the process — and
    /// cancelling is what releases it, because the cancel handler above is the only thing that
    /// closes it. Cancelling twice is not closing twice: the handler runs once.
    deinit {
        source.cancel()
    }
}
