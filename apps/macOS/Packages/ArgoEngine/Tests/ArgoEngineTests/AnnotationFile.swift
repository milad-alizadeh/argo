@testable import ArgoEngine
import Foundation

/// A throwaway `userData` location: a file that does not exist yet, under a folder that is
/// deleted when the test is done.
///
/// Its own file rather than a private helper beside one suite, because every annotation the store
/// holds is round-tripped the same way — through a location that is not the machine's own. A suite
/// that wrote to Application Support would archive and rename the Sessions of whoever ran it.
struct AnnotationFile {
    let directoryURL = URL(fileURLWithPath: NSTemporaryDirectory())
        .appending(path: "argo-annotations-\(UUID().uuidString)", directoryHint: .isDirectory)

    var url: URL {
        directoryURL.appending(path: "Argo/sessions.json")
    }

    func store() -> SessionAnnotationStore {
        SessionAnnotationStore(fileURL: url)
    }

    func write(_ contents: String) throws {
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true,
        )
        try contents.write(to: url, atomically: true, encoding: .utf8)
    }

    func read() throws -> String {
        try String(contentsOf: url, encoding: .utf8)
    }

    func remove() {
        try? FileManager.default.removeItem(at: directoryURL)
    }
}
