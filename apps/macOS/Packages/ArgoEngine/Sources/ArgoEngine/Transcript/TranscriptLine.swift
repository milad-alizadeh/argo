/// One complete line of a transcript, and where it sits in the file.
///
/// The offset is carried rather than counted downstream because it is what lets a picture be
/// ADDRESSED instead of held (`MediaBytes`): a base64 run's place in the file is its line's place
/// plus its own place in the line, and only the cursor that read the line knows the first half.
public struct TranscriptLine: Sendable, Equatable {
    public let text: String
    /// Where the line's first byte sits in the file.
    public let byteOffset: Int

    public init(text: String, byteOffset: Int) {
        self.text = text
        self.byteOffset = byteOffset
    }
}
