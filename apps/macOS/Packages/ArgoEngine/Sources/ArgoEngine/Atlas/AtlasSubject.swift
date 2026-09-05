import CryptoKit
import Foundation

/// What a Note was written ABOUT, on this machine: where it sits, and what it holds now (#1159).
///
/// Here rather than in `AtlasLayout` because both halves open a file, which is engine work and
/// never the layout half's or the main actor's (ADR-0028 rule 6). The layout half decides what a
/// digest MEANS — current, stale or unchecked — over digests it is handed.
enum AtlasSubject {
    /// How much of the SHA-256 a subject is recorded by: sixteen hex digits, the prototype's own
    /// stamp. A digest is only ever compared to another digest of the same file, so the question
    /// it has to survive is accidental collision between two versions of one file rather than
    /// forgery: sixty-four bits is far past that, and a shorter record keeps the written layer a
    /// file a person can still read.
    static let digestLength = 16

    /// Where the file a Note names sits on this machine, or nothing where the path does not
    /// describe a file inside this repository.
    ///
    /// A Map path is the repository's own folder name and then the file's path under it, so the
    /// first component is dropped and the rest is resolved against the working tree. `..` is
    /// refused rather than resolved: the written layer is a file this process did not write, and a
    /// path that climbs out of the repository would have it digesting something else entirely.
    static func url(of path: String, under repositoryURL: URL, inside root: String) -> URL? {
        let components = path.split(separator: "/").map(String.init)
        guard components.first == root, components.count > 1 else { return nil }
        let inside = components.dropFirst()
        guard !inside.contains("..") else { return nil }
        return repositoryURL.appending(path: inside.joined(separator: "/"))
    }

    /// What the file holds now, digested the way the written layer records it — or nothing where
    /// there is no file to read, which leaves the Note unchecked rather than stale.
    static func digest(of fileURL: URL) -> String? {
        guard let data = try? Data(contentsOf: fileURL, options: .mappedIfSafe) else { return nil }
        return SHA256.hash(data: data)
            .map { String(format: "%02x", $0) }
            .joined()
            .prefix(digestLength)
            .description
    }
}
