import Foundation

/// One command run through the user's `PATH`: its stdout verbatim, or `nil` where it answered
/// nothing at all — no such tool, a non-zero exit. What the output MEANS is the reader's, not this.
typealias ShellCommand = @Sendable ([String]) -> String?

/// The real command. Blocking, so every caller of it is an actor that expects to wait.
///
/// `readToEnd()` rather than `readDataToEndOfFile()`, for the reason `gitCommand` spells out: the
/// older read raises an uncatchable Objective-C exception on a descriptor that has gone bad, and
/// this one hands back an error that becomes the `nil` this signature already carries.
let shellCommand: ShellCommand = { arguments in
    let process = Process()
    let output = Pipe()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = arguments
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
