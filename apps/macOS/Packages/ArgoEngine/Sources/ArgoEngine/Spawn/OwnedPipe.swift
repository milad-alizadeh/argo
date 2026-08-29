import Foundation

/// A pipe whose two descriptors are closed exactly once, by the code that made them.
///
/// `Foundation.Pipe` cannot be handed to a `Process`. `run()` closes the end the child inherited
/// with a raw `close`, and the `Pipe`'s own `FileHandle` closes that NUMBER again when it
/// deallocates — by which time the kernel has usually given it to something else. Caught with an
/// `fd` guard on the permission gate's listening socket: the closer is `-[NSConcretePipe dealloc]`
/// → `-[NSConcreteFileHandle dealloc]` → `close`, and taking that socket out of its listen state
/// left its socket FILE in place, so every later dial was refused rather than accepted (#936).
/// This is the closer `CheckoutReading` degraded around without finding (#588).
///
/// Both handles are `closeOnDealloc: false`, and Foundation leaves a handle it did not open alone,
/// so the only closes are the ones below.
final class OwnedPipe {
    let reading: FileHandle
    let writing: FileHandle
    private var held: [Int32]

    init() throws {
        var ends: [Int32] = [-1, -1]
        let made = ends.withUnsafeMutableBufferPointer { buffer in
            buffer.baseAddress.map { pipe($0) } ?? -1
        }
        guard made == 0 else {
            throw AgentSpawnError.hostRefused(detail: "A pipe could not be opened")
        }
        self.reading = FileHandle(fileDescriptor: ends[0], closeOnDealloc: false)
        self.writing = FileHandle(fileDescriptor: ends[1], closeOnDealloc: false)
        self.held = ends
    }

    /// Give up one end. The child holds its own copy of the descriptor, so a parent still holding
    /// this one is what makes a read to EOF never end.
    func release(_ end: FileHandle) {
        guard let index = held.firstIndex(of: end.fileDescriptor) else { return }
        Darwin.close(held.remove(at: index))
    }

    deinit {
        for descriptor in held {
            Darwin.close(descriptor)
        }
    }
}
