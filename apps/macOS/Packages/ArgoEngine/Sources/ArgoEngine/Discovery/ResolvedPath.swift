import Foundation

/// How the file system spells each path asked about, keyed by the path as written — every symlink
/// followed, or the path unchanged where the file system could not say.
///
/// A BATCH rather than one path at a time: the caller resolves a whole roster on one beat, and each
/// hop off the main actor is a suspension.
public typealias PathResolutionRead = @Sendable ([String]) async -> [String: String]

/// The two sides of a liveness match come from different places and spell the same folder
/// differently: `lsof` answers with a fully resolved path, while a transcript reports whatever the
/// agent was launched with. On macOS that alone is enough to miss — `/tmp` is a symlink to
/// `/private/tmp`, and so is every folder a session runs in under it.
public let realpathResolutionRead: PathResolutionRead = { paths in
    await pathResolver.resolving(paths)
}

/// An actor because `realpath` is a file-system call and the caller is the main actor, which
/// ADR-0028 Rule 6 keeps clear of them — the same reason `ProcessLivenessReader` is one. Stateless:
/// what has already been spelled is held by the caller, which is where a bound on it exists.
private actor PathResolver {
    func resolving(_ paths: [String]) -> [String: String] {
        paths.reduce(into: [String: String]()) { spelled, path in
            spelled[path] = resolvedPath(path)
        }
    }
}

private let pathResolver = PathResolver()

/// `realpath` rather than `URL.resolvingSymlinksInPath`, which leaves `/tmp` and `/var` exactly as
/// it found them. A path nothing exists at resolves to itself: an answer that cannot be checked is
/// better compared as written than dropped.
///
/// `private`, which in Swift is FILE-scoped: the actor above is the only caller `realpath` has in
/// this module, so no `@MainActor` type can reach it even by extension.
private func resolvedPath(_ path: String) -> String {
    guard let resolved = realpath(path, nil) else { return path }
    defer { free(resolved) }
    return String(cString: resolved)
}

/// A path as the file system spells it — every symlink followed, or the path unchanged where it
/// could not say. The only thing `ProjectScope` compares, so a caller that skipped the spelling
/// step does not compile (#363). `init` is fileprivate: `spelling(of:)` below is the only mint.
struct SpelledPath: Hashable, Sendable {
    let value: String

    fileprivate init(_ value: String) {
        self.value = value
    }
}

extension [String: String] {
    /// How this batch spells one path, and the path AS WRITTEN where it holds no answer: a resolve
    /// is I/O and fails for a folder that has been deleted, and an equal string is still the same
    /// folder.
    func spelling(of path: String) -> SpelledPath {
        SpelledPath(self[path] ?? path)
    }
}
