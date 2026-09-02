import Foundation

extension AgentCLI {
    /// What this CLI names the directory it writes one Project's transcripts into, from the
    /// Project's own path.
    ///
    /// FORWARD only. The encoding is lossy — every `/` and every `.` becomes `-`, so `/a/b` and
    /// `/a.b` land on one name — which is why `TranscriptOrigin` reads a transcript's `cwd` out of
    /// its head rather than reading this back. Encoding a path Argo already holds and comparing the
    /// result is exact in the direction it is used here: a name EQUAL to this one was written for a
    /// path that encodes the same way, and nothing is decoded.
    ///
    /// `nil` for the filesystem root, which `ProjectScope` scopes to nothing rather than to
    /// everything, and for a CLI whose record has no such directory.
    func recordDirectoryName(forProjectRoot path: String) -> String? {
        switch self {
        case .claude:
            let trimmed = path.hasSuffix("/") ? String(path.dropLast()) : path
            guard trimmed.hasPrefix("/"), trimmed.count > 1 else { return nil }
            return String(trimmed.map { $0 == "/" || $0 == "." ? "-" : $0 })
        // Codex files its records by date rather than by Project, so there is no name here to
        // compare — and borrowing Claude Code's would be a convention Argo invented.
        case .codex:
            return nil
        }
    }
}
