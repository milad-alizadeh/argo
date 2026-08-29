import Foundation

/// One command run through the user's `PATH`: its stdout verbatim, or `nil` where it answered
/// nothing at all — no such tool, a non-zero exit. What the output MEANS is the reader's, not this.
typealias ShellCommand = @Sendable ([String]) -> String?

/// The real command. Blocking, so every caller of it is an actor that expects to wait.
let shellCommand: ShellCommand = { arguments in
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = arguments
    return capturedOutput(of: process)
}

/// Run it to the end and take its stdout, or `nil` for anything that is not a clean run.
///
/// The pipe is an `OwnedPipe` and never a `Foundation.Pipe`, for the stray close that one leaves
/// behind on a descriptor number the kernel has since given to something else (#936).
///
/// `readToEnd()` rather than `readDataToEndOfFile()`: the older read answers a descriptor that has
/// gone bad by RAISING `NSFileHandleOperationException`, which no Swift `catch` can see, so it
/// takes the whole process down.
func capturedOutput(of process: Process) -> String? {
    guard let pipe = try? OwnedPipe() else { return nil }
    process.standardOutput = pipe.writing
    process.standardError = FileHandle.nullDevice
    guard (try? process.run()) != nil else { return nil }
    // The child has its own copy of the write end; the parent's goes now, or the read below never
    // reaches EOF.
    pipe.release(pipe.writing)
    let data = try? pipe.reading.readToEnd()
    process.waitUntilExit()
    guard process.terminationStatus == 0, let data else { return nil }
    return String(data: data, encoding: .utf8)
}
