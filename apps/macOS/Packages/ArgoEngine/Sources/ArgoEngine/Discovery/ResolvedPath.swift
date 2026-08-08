import Foundation

/// A path with every symlink resolved, or the path unchanged where the file system could not say.
///
/// The two sides of a liveness match come from different places and spell the same folder
/// differently: `lsof` answers with a fully resolved path, while a transcript reports whatever the
/// agent was launched with. On macOS that alone is enough to miss — `/tmp` is a symlink to
/// `/private/tmp`, and so is every folder a session runs in under it.
///
/// `realpath` rather than `URL.resolvingSymlinksInPath`, which leaves `/tmp` and `/var` exactly as
/// it found them. A path nothing exists at resolves to itself: an answer that cannot be checked is
/// better compared as written than dropped.
func resolvedPath(_ path: String) -> String {
    guard let resolved = realpath(path, nil) else { return path }
    defer { free(resolved) }
    return String(cString: resolved)
}
