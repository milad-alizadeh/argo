@testable import ArgoEngine
import Foundation
import Testing

/// Who closes a descriptor a `Process` was given (#936).
///
/// The bug this pins is invisible from behaviour: `Foundation.Pipe` hands `run()` the child's end,
/// `run()` closes it with a raw `close`, and the `Pipe`'s own `FileHandle` closes that NUMBER again
/// when it deallocates — landing on whatever the kernel has since given it. It took the permission
/// gate's listening socket out of its listen state, and every dial after that was refused while the
/// socket file sat on disk. So the assertion is on the descriptor, because that IS the contract.
@Suite("Process pipe ownership")
struct OwnedPipeTests {
    @Test
    func `a descriptor lent to a process is still the lender's to close`() throws {
        let pipe = try OwnedPipe()
        let lent = pipe.writing.fileDescriptor
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/echo")
        process.arguments = ["hello"]
        process.standardOutput = pipe.writing
        try process.run()

        #expect(fcntl(lent, F_GETFD) >= 0, "the spawn closed a descriptor it was only lent")

        pipe.release(pipe.writing)
        process.waitUntilExit()
    }

    @Test
    func `a second release of one end takes nothing with it`() throws {
        let pipe = try OwnedPipe()
        pipe.release(pipe.reading)
        // Usually the number just freed, which is the whole point: that is what a second close
        // would take.
        let taken = socket(AF_UNIX, SOCK_STREAM, 0)
        defer { Darwin.close(taken) }

        pipe.release(pipe.reading)

        #expect(fcntl(taken, F_GETFD) >= 0)
    }
}
