import Metal

/// The one instance buffer the city's boxes are written into (#1598).
///
/// Held and rewritten rather than allocated per city: a `makeBuffer(bytes:)` per map was a fresh
/// allocation and a copy of every box in the repository, and `AtlasSurface` used to reach it once
/// per drag frame. It is written now only when the plan or the pigments move.
///
/// It grows and never shrinks. A city that fits the buffer already there is written into it, so a
/// re-tile of the same repository costs the copy alone — and a smaller city leaves the tail of the
/// buffer holding boxes nothing draws, because `boxes` is what the encoder draws instances from.
@MainActor
final class AtlasVolumeBuffer {
    private let device: MTLDevice

    /// What the encoder binds, or nothing until a city has been written — and nothing again if the
    /// device ever refuses the allocation, which `boxes` follows down to 0 so the pass encodes
    /// none rather than drawing off the end of a buffer that is not there.
    private(set) var buffer: MTLBuffer?

    /// How many boxes the buffer can hold.
    private(set) var capacity = 0

    /// How many of them the last city wrote, which is the instance count of the draw. Named for
    /// the boxes rather than spelled `count`, because a map with none encodes no pass at all and
    /// that is a real state — a repository nobody has scanned yet — rather than an empty
    /// collection.
    private(set) var boxes = 0

    private static let stride = MemoryLayout<AtlasVolume>.stride

    init(device: MTLDevice) {
        self.device = device
    }

    /// Write one city's boxes in, growing the buffer only where the city has outgrown it.
    func write(_ volumes: [AtlasVolume]) {
        guard !volumes.isEmpty else {
            boxes = 0
            return
        }
        if capacity < volumes.count {
            // Shared storage, stated rather than defaulted: the CPU writes these and the GPU only
            // reads them, and a managed buffer would need every write declared to Metal by range
            // — a second thing to keep in step with the copy below.
            guard let grown = device.makeBuffer(
                length: Self.stride * volumes.count, options: .storageModeShared,
            ) else {
                buffer = nil
                capacity = 0
                boxes = 0
                return
            }
            buffer = grown
            capacity = volumes.count
        }
        guard let contents = buffer?.contents() else {
            boxes = 0
            return
        }
        volumes.withUnsafeBytes { raw in
            guard let base = raw.baseAddress else { return }
            contents.copyMemory(from: base, byteCount: raw.count)
        }
        boxes = volumes.count
    }
}
