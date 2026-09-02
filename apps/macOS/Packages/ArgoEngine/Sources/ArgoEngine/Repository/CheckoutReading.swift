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
///
/// The read is `readToEnd()` and not `readDataToEndOfFile()`, which is the same read with a
/// different failure mode: the older one answers a descriptor that has gone bad underneath it by
/// RAISING `NSFileHandleOperationException`, an Objective-C exception no Swift `catch` can see, so
/// it takes the whole process down. The throwing spelling hands back an error, and a read that
/// produced nothing is exactly the `nil` this signature already carries for "git answered nothing".
///
/// The stray closer it was hardened against was a test fixture's, never the app's (#936/#981).
let gitCommand: GitCommand = { arguments, directoryURL in
    let process = Process()
    let output = Pipe()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = ["git", "-C", directoryURL.path] + arguments
    process.standardOutput = output
    process.standardError = FileHandle.nullDevice
    guard (try? process.run()) != nil else { return nil }
    guard let data = try? output.fileHandleForReading.readToEnd() else {
        process.waitUntilExit()
        return nil
    }
    process.waitUntilExit()
    guard process.terminationStatus == 0 else { return nil }
    return String(data: data, encoding: .utf8)
}
