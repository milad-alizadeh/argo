@testable import ArgoEngine

/// A disk reader that answers every path with the same run, HELD rather than addressed: the suites
/// that reach for this are about the source-preference order, not about where a run is read from.
func fixedImageReader(_ base64: String) -> ImageReader {
    { _ in .held(base64) }
}
