/// The wall-clock moments a Session is placed in time by.
///
/// Each only ever moves the one way it can — the latest forward, the earliest back while the
/// reading is whole, the file's own write forward — and an absent reading says nothing: a record
/// with no timestamp is not a Session that ran at the epoch.
struct SessionMoments: Equatable, Sendable {
    /// The most recent moment the records report.
    private(set) var lastActivityAtMs: Int?
    /// The oldest moment the records report. The roster's sort key, and no longer any part of
    /// ownership: a claim names its Session rather than matching a window (#742).
    private(set) var startedAtMs: Int?
    /// The file's own last write — what a transcript whose records carry no time still says about
    /// when it ran.
    private(set) var recordedAtMs: Int?

    init(startedAtMs: Int? = nil, lastActivityAtMs: Int? = nil, recordedAtMs: Int? = nil) {
        self.startedAtMs = startedAtMs
        self.lastActivityAtMs = lastActivityAtMs
        self.recordedAtMs = recordedAtMs
    }

    /// The latest time wins, and an absent one is ignored rather than folded.
    ///
    /// The EARLIEST is only taken while the reading is still `whole`. A moment read after a bounded
    /// read's seam sits behind a stretch nobody opened, so it cannot be the earliest one the file
    /// holds — and an unread start is unknown rather than "the oldest thing this happened to see"
    /// (`SessionTranscriptExtent`). The roster sorts on the latest, which a tail always reads, so
    /// what this withholds costs no row its place.
    mutating func observe(_ atMs: Int?, extent: SessionTranscriptExtent) {
        guard let atMs else { return }
        lastActivityAtMs = max(lastActivityAtMs ?? atMs, atMs)
        guard extent == .whole else { return }
        startedAtMs = min(startedAtMs ?? atMs, atMs)
    }

    /// The later link of a resume chain reports its own two moments, and each folds exactly as a
    /// record's own would. Its FILE is a third one: two links are two files, so the pair's last
    /// write is the later of them, and neither absence invents a time.
    mutating func merge(_ continuation: SessionMoments, extent: SessionTranscriptExtent) {
        observe(continuation.lastActivityAtMs, extent: extent)
        observe(continuation.startedAtMs, extent: extent)
        recordedAtMs = continuation.recordedAtMs.map { max(recordedAtMs ?? $0, $0) } ?? recordedAtMs
    }
}
