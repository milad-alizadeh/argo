import Foundation

/// Every inter-frame interval the display link reported, kept as a rolling window and a file.
///
/// The reading is recomputed once per BATCH rather than once per frame, and that is the whole
/// design constraint of this type: sorting a couple of hundred doubles sixty times a second, inside
/// the main run loop whose stalls are the measurement, would put the instrument's own cost into
/// every number it reports.
@MainActor
@Observable
final class FrameRecorder {
    /// About two seconds at 120Hz — long enough for the HUD to describe a drag rather than a
    /// moment, short enough that letting go of the trackpad clears it while the reader watches.
    private static let window = 240
    /// A quarter of a second of frames. Small enough that quitting mid-drag loses almost nothing,
    /// large enough that the write is four times a second and not sixty.
    private static let batch = 30

    /// What the HUD draws. The only observed property, so nothing re-renders per frame.
    private(set) var reading = FrameReading(milliseconds: [])

    private var recent: [Double]
    private var cursor = 0
    private var pending: [Double] = []
    private let log: FrameLog?

    init(flag: FrameFlag) {
        self.recent = Array(repeating: 0, count: Self.window)
        self.log = flag.logPath.flatMap(FrameLog.init(path:))
    }

    func record(_ milliseconds: Double) {
        recent[cursor % Self.window] = milliseconds
        cursor += 1
        pending.append(milliseconds)
        guard pending.count >= Self.batch else { return }
        settle()
    }

    /// Everything held back, written and counted. Called on the batch and again when the meter
    /// leaves the window, so the tail of a run is not the part that goes missing.
    func settle() {
        guard !pending.isEmpty else { return }
        log?.append(pending)
        pending.removeAll(keepingCapacity: true)
        reading = FrameReading(milliseconds: Array(recent.prefix(min(cursor, Self.window))))
    }
}
