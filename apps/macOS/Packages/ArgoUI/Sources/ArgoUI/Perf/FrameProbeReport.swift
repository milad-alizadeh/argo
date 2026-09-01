import Foundation

/// Where a closed measurement window lands: the path in `ARGO_FRAME_PROBE_OUT`, or stderr.
///
/// It opens a file on the main actor, which ADR-0028 Rule 6 forbids of anything the app does. That
/// rule is about work a session pays for; this runs once, after the last frame it measures, and
/// only under `ARGO_FRAME_PROBE=1`.
enum FrameProbeReport {
    static func write(_ summary: FrameProbeSummary) {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(summary) else {
            report("frame-probe: the summary would not encode")
            return
        }
        guard let path = ProcessInfo.processInfo.environment["ARGO_FRAME_PROBE_OUT"] else {
            FileHandle.standardError.write(data + Data("\n".utf8))
            return
        }
        do {
            try data.write(to: URL(fileURLWithPath: path))
            report("frame-probe: \(summary.frameCount) frames -> \(path)")
        } catch {
            report("frame-probe: \(path) could not be written — \(error.localizedDescription)")
        }
    }

    private static func report(_ line: String) {
        FileHandle.standardError.write(Data((line + "\n").utf8))
    }
}
