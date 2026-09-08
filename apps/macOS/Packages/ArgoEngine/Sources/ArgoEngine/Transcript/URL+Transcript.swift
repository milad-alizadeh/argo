import Foundation

extension URL {
    /// The filename without its transcript format suffix, independent of its directory.
    var transcriptStem: String {
        deletingPathExtension().lastPathComponent
    }
}
