import Foundation
import Synchronization

/// A pipe emptied on another thread while the process writing it is still running, and the text it
/// collected once that writer has closed it.
///
/// Two pipes read one after the other DEADLOCK in exactly the case stderr matters most. A pipe
/// nobody is reading fills at the kernel's buffer and stops the process writing into it: a `git`
/// that printed more diagnostic than the buffer holds blocks on stderr, so it never closes stdout,
/// so the read of stdout waits for an end that cannot arrive. Draining the second channel
/// alongside the first is what makes capturing both safe.
///
/// `readToEnd()` rather than `readDataToEndOfFile()`, for the reason `gitInvocation` spells out:
/// the older read answers a descriptor that has gone bad by raising an Objective-C exception no
/// Swift `catch` can see. What it hands back here is the empty text a channel nobody wrote to has.
final class PipeDrain: Sendable {
    private let collected = Mutex<Data>(Data())
    private let group = DispatchGroup()

    init(draining pipe: Pipe) {
        let handle = pipe.fileHandleForReading
        DispatchQueue.global(qos: .userInitiated).async(group: group) { [self] in
            let read = (try? handle.readToEnd()) ?? Data()
            collected.withLock { $0 = read }
        }
    }

    /// Everything the pipe carried. Waits for the read to end, so the writer has to be on its way
    /// out before this is asked — after `waitUntilExit()`, never before it.
    func text() -> String {
        group.wait()
        return collected.withLock { String(data: $0, encoding: .utf8) ?? "" }
    }
}
