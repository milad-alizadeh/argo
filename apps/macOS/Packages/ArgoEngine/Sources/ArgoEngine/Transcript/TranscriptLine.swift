/// One complete line of a transcript, and where it sits in the file.
///
/// The offset is carried rather than counted downstream because it is what lets a picture be
/// ADDRESSED instead of held (`MediaBytes`): a base64 run's place in the file is its line's place
/// plus its own place in the line, and only the cursor that read the line knows the first half.
public struct TranscriptLine: Sendable, Equatable {
    public let text: String
    /// Where the line's first byte sits in the file.
    public let byteOffset: Int
    /// Whether the reading SKIPPED a stretch of the file in front of this line — the seam a
    /// bounded read leaves between a transcript's two ends (`TranscriptExcerpt`). Carried on the
    /// line because the seam has a PLACE: the events read after it are later than the ones before
    /// it, with a hole between, and a marker put anywhere else would say less than that.
    public let followsGap: Bool

    public init(text: String, byteOffset: Int, followsGap: Bool = false) {
        self.text = text
        self.byteOffset = byteOffset
        self.followsGap = followsGap
    }
}
