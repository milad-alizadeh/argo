import Foundation

/// Reading the checkout of a candidate folder: which repository it belongs to, and what its HEAD
/// is.
///
/// A port rather than a direct call to `git`, so what the Hub makes of a checkout is falsifiable
/// without a repository on disk — the same shape `transcriptEvents(at:readImage:)` gives the other
/// engine read.
public typealias CheckoutRead = @Sendable (URL) async -> CheckoutProjection

/// One `git` invocation in a folder: its stdout verbatim, or `nil` where git answered nothing at
/// all — no git, no such folder, a non-zero exit. What the output MEANS is the reader's, not this.
typealias GitCommand = @Sendable ([String], URL) -> String?

/// The app's adapter: git, read through a subprocess. One reader for the process, so the blocking
/// calls queue behind one another rather than running a subprocess per caller.
public let gitCheckoutRead: CheckoutRead = { url in
    await gitCheckoutReader.read(at: url)
}

private let gitCheckoutReader = CheckoutReader()

/// The real command.
let gitCommand: GitCommand = { arguments, directoryURL in
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = ["git", "-C", directoryURL.path] + arguments
    return capturedOutput(of: process)
}
