import Foundation

/// A path with every symlink followed, for a suite that has to compare against the same name:
/// Foundation's `resolvingSymlinksInPath` leaves `/tmp` and `/var` alone, which is exactly where a
/// test writes.
///
/// The suite's own copy of the three lines. The engine's is private to `ResolvedPath.swift` so that
/// no `@MainActor` type can reach `realpath` (ADR-0028 Rule 6), and reaching past that here would
/// be the same hole with a `@testable` on it.
func resolvedTestPath(_ path: String) -> String {
    guard let resolved = realpath(path, nil) else { return path }
    defer { free(resolved) }
    return String(cString: resolved)
}
