/// Where the line being read sits in the file that carried it, so a base64 run inside it can be
/// ADDRESSED rather than held (`MediaBytes`).
///
/// The line's text rides along because that is what the run's own offset is found in, and it is
/// gone the moment the line has been read — it is the retained copy that this type exists to
/// prevent. `nil` everywhere the reader has no file behind it, which is a fixture and never a tail.
struct MediaLocation: Sendable {
    /// The transcript's path, which is the id the Hub keys a Session by.
    let transcript: String
    let line: String
    /// Where the line's first byte sits in the file.
    let byteOffset: Int
}
