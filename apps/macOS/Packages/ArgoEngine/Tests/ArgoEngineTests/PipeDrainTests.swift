@testable import ArgoEngine
import Foundation
import Testing

/// The reason both channels are read at once rather than one after the other.
@Suite("Draining a second channel")
struct PipeDrainTests {
    /// Well past a 64KB pipe buffer on stderr, with one short line on stdout.
    static let longOnStderr = "awk 'BEGIN { for (i = 0; i < 40000; i++) print i }' >&2; echo done"

    /// A process printing more on stderr than the kernel's pipe buffer holds, read exactly the way
    /// `gitInvocation` reads one. Read in series this deadlocks: the writer blocks on a full
    /// stderr, never closes stdout, and the read of stdout never ends. The test would hang rather
    /// than fail, which is the only way this failure can be shown.
    @Test(.timeLimit(.minutes(1)))
    func `a channel too long for the buffer does not stop the other one`() throws {
        let process = Process()
        let output = Pipe()
        let errors = Pipe()
        process.executableURL = URL(fileURLWithPath: "/bin/sh")
        process.arguments = ["-c", Self.longOnStderr]
        process.standardOutput = output
        process.standardError = errors
        try process.run()
        let printed = PipeDrain(draining: errors)
        let data = try #require(try output.fileHandleForReading.readToEnd())
        process.waitUntilExit()
        #expect(String(data: data, encoding: .utf8) == "done\n")
        #expect(printed.text().count > 65536)
    }

    @Test
    func `a channel nothing was written to carries no text`() throws {
        let process = Process()
        let errors = Pipe()
        process.executableURL = URL(fileURLWithPath: "/bin/sh")
        process.arguments = ["-c", "exit 0"]
        process.standardOutput = FileHandle.nullDevice
        process.standardError = errors
        try process.run()
        let printed = PipeDrain(draining: errors)
        process.waitUntilExit()
        #expect(printed.text().isEmpty)
    }
}
