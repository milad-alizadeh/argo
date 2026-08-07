import Foundation

/// One candidate transcript on disk: where it is, and when it was last written.
///
/// The mtime is the whole point of the type. It is what the sweep filters on, and reading it is a
/// `stat` rather than an open — which is what lets a Project holding thousands of historical
/// transcripts be surveyed without any of them being read.
struct TranscriptFile: Equatable, Sendable {
    let url: URL
    let modifiedAt: Date

    /// `nil` for a file whose mtime cannot be read: it was deleted between the listing and the
    /// stat, and a candidate that cannot be dated cannot be bounded.
    init?(url: URL) {
        guard let modifiedAt = try? url
            .resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
        else { return nil }
        self.url = url.standardizedFileURL
        self.modifiedAt = modifiedAt
    }
}
