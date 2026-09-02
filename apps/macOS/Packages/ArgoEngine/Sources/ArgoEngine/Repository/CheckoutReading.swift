import Foundation

/// Reading the checkout of a candidate folder: which repository it belongs to, and what its HEAD
/// is.
///
/// A port rather than a direct call to `git`, so what the Hub makes of a checkout is falsifiable
/// without a repository on disk — the same shape `transcriptEvents(at:readImage:)` gives the other
/// engine read.
public typealias CheckoutRead = @Sendable (URL) async -> CheckoutProjection

/// One `git` invocation in a folder, answered whole — both channels and the exit status. `nil`
/// only where the subprocess could not be launched; a git that ran and refused is an answer with a
/// non-zero status, and the stderr behind it is the point of this spelling.
typealias GitInvocation = @Sendable ([String], URL) -> GitAnswer?

/// One `git` invocation in a folder: its stdout verbatim, or `nil` where git answered nothing at
/// all — no git, no such folder, a non-zero exit. What the output MEANS is the reader's, not this.
typealias GitCommand = @Sendable ([String], URL) -> String?

/// The app's adapter: git, read through a subprocess. One reader for the process, so the blocking
/// calls queue behind one another rather than running a subprocess per caller.
public let gitCheckoutRead: CheckoutRead = { url in
    await gitCheckoutReader.read(at: url)
}

private let gitCheckoutReader = CheckoutReader()

/// The real invocation, with both channels kept.
///
/// The read is `readToEnd()` and not `readDataToEndOfFile()`, which is the same read with a
/// different failure mode: the older one answers a descriptor that has gone bad underneath it by
/// RAISING `NSFileHandleOperationException`, an Objective-C exception no Swift `catch` can see, so
/// it takes the whole process down. The throwing spelling hands back an error, and a read that
/// produced nothing is exactly the `nil` `GitAnswer.output` carries for "git answered nothing".
///
/// The stray closer it was hardened against was a test fixture's, never the app's (#936/#981).
///
/// stderr is drained on another thread rather than read after stdout — `PipeDrain` says why.
let gitInvocation: GitInvocation = { arguments, directoryURL in
    let process = Process()
    let output = Pipe()
    let errors = Pipe()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = ["git", "-C", directoryURL.path] + arguments
    process.standardOutput = output
    process.standardError = errors
    guard (try? process.run()) != nil else { return nil }
    let printed = PipeDrain(draining: errors)
    let data = try? output.fileHandleForReading.readToEnd()
    process.waitUntilExit()
    return GitAnswer(
        output: data.flatMap { String(data: $0, encoding: .utf8) },
        errorOutput: printed.text(),
        status: process.terminationStatus,
    )
}

/// The reads' own spelling of the same invocation: stdout where git answered, `nil` where it did
/// not. The four read paths have no failure surface to put stderr on, so the discard is HERE — one
/// line, rather than at the subprocess where a git write would inherit it.
let gitCommand: GitCommand = { arguments, directoryURL in
    guard let answer = gitInvocation(arguments, directoryURL), answer.isSuccess else { return nil }
    return answer.output
}
