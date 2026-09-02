@testable import ArgoEngine
import Foundation
import Testing

/// What the real `git` adapter keeps of an invocation, against real repositories (#1045).
///
/// The claim these exist for is that stderr is a value: §5 of `cockpit-failure-states-spec.md`
/// makes git's own diagnostic the actionable half of a git failure, and the first git write to
/// land must be able to hand it on rather than send it to `/dev/null`.
@Suite("Git answers")
struct GitAnswerTests {
    @Test
    func `a folder that is no repository carries git's own diagnostic`() throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let plain = try fixture.folder("plain")
        let answer = try #require(gitInvocation(["rev-parse", "--show-toplevel"], plain))
        #expect(!answer.isSuccess)
        #expect(answer.errorOutput.contains("not a git repository"))
    }

    @Test
    func `a read that worked answers on stdout and prints nothing on stderr`() throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let repository = try fixture.folder("repo", git: true)
        let answer = try #require(gitInvocation(["rev-parse", "--show-toplevel"], repository))
        #expect(answer.isSuccess)
        #expect(answer.output?.contains("repo") == true)
        #expect(answer.errorOutput.isEmpty)
    }

    /// The four read paths are unchanged by any of this: they see one string or nothing, and a
    /// refusal is still nothing.
    @Test
    func `the reads still collapse a refusal to absence`() throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let plain = try fixture.folder("plain")
        #expect(gitCommand(["rev-parse", "--show-toplevel"], plain) == nil)
    }

    @Test
    func `the reads still take git's answer verbatim`() throws {
        let fixture = try ProjectFixture()
        defer { fixture.remove() }
        let repository = try fixture.folder("repo", git: true)
        let read = try #require(gitCommand(["rev-parse", "--show-toplevel"], repository))
        #expect(read.contains("repo"))
    }
}

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
