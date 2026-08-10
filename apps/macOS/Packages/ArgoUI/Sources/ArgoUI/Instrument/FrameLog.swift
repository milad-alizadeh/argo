import Foundation

/// The raw intervals, one per line, so a reported number can be recomputed from what was actually
/// observed rather than taken on the HUD's word.
///
/// Written in batches. A file write per frame is work the measurement would then be measuring —
/// the instrument has to be cheaper than the thing it is watching, or the first hitch it reports is
/// its own.
@MainActor
struct FrameLog {
    private let handle: FileHandle

    init?(path: String) {
        let manager = FileManager.default
        if !manager.fileExists(atPath: path) {
            manager.createFile(atPath: path, contents: nil)
        }
        guard let opened = FileHandle(forWritingAtPath: path) else { return nil }
        opened.seekToEndOfFile()
        handle = opened
    }

    func append(_ milliseconds: [Double]) {
        guard !milliseconds.isEmpty else { return }
        let lines = milliseconds.map { String(format: "%.3f", $0) }.joined(separator: "\n") + "\n"
        do {
            try handle.write(contentsOf: Data(lines.utf8))
        } catch {
            // A measurement log that cannot be written is not worth taking the launch down for:
            // the HUD is still on screen and still says the same thing.
        }
    }
}
