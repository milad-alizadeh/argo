import Foundation

/// One command run through the user's `PATH`: its stdout verbatim, or `nil` where it answered
/// nothing at all — no such tool, a non-zero exit. What the output MEANS is the reader's, not this.
typealias ShellCommand = @Sendable ([String]) -> String?

/// The real command. Blocking, so every caller of it is an actor that expects to wait.
let shellCommand: ShellCommand = { arguments in
    let process = Process()
    let output = Pipe()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = arguments
    process.standardOutput = output
    process.standardError = FileHandle.nullDevice
    guard (try? process.run()) != nil else { return nil }
    let data = output.fileHandleForReading.readDataToEndOfFile()
    process.waitUntilExit()
    guard process.terminationStatus == 0 else { return nil }
    return String(data: data, encoding: .utf8)
}
