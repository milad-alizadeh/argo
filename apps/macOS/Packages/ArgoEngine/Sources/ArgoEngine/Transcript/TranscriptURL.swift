import Foundation

extension URL {
    /// The stable Session UUID carried by a transcript filename, independent of its directory.
    var transcriptSessionID: String {
        deletingPathExtension().lastPathComponent
    }
}
