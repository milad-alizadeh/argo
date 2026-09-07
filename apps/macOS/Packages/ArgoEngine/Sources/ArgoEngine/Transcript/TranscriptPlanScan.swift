import Foundation

/// Every plan write in one transcript, folded — the list a bounded read cannot rebuild.
///
/// A host that writes `TaskCreate`/`TaskUpdate` writes ONE entry at a time, and the list exists
/// nowhere in the record: it is the fold of every such write from the file's first. So a read that
/// sees only the file's two ends sees three of a Session's thirty writes and rebuilds a list of
/// three entries — wrong, not stale, and drawn on a row as if it were whole (#1594).
///
/// The records are small and sparse, so this walks the WHOLE file for them alone: every chunk is
/// cut on newlines as RAW bytes, only a line a marker matched is decoded and parsed, and every
/// other line is discarded without ever becoming a `String`. Measured on this repo's own record
/// directory, over the same seven-day window ADR-0008 sizes the working set by — 165 transcripts,
/// 223.5 MB — it parses 752 lines, 3.9 MB, against the 19.1 MB those files' two ends parse. That is
/// what `bytesKept` reports and what `TranscriptReadCostTests` gates (ADR-0028 Rule 8).
struct TranscriptPlanScan {
    /// How much is held in memory at once. Nothing about the answer turns on it: a record
    /// straddling two chunks is carried into the next, so the fold is the file's own order.
    static let chunkByteLimit = 256 * 1024

    /// The bytes that make a line worth parsing. `"task":` is the RESULT's marker — a create's id
    /// is reported there and nowhere else, and that record names no tool. Each is deliberately
    /// wider than the record it is after: a line matched here that carries no plan write costs one
    /// parse, and a line missed here costs the Session its Plan.
    private static let markers = [
        "\"TaskCreate\"",
        "\"TaskUpdate\"",
        "\"\(planTool)\"",
        "\"task\":",
    ]
    .map { Data($0.utf8) }

    /// The ledger as the file leaves it, ready to be handed to the reader that folds what is
    /// appended NEXT. Every call in it is already folded, so re-reading one writes nothing.
    private(set) var ledger = PlanLedger()
    /// The whole list after the file's last plan write, or `nil` for a file that made none — and
    /// for one this could not read to the end of, because a fold of part of a file is the wrong
    /// list rather than an old one.
    private(set) var plan: Plan?
    /// Bytes asked of the file system. The file's length for a scan that finished, because a sparse
    /// record cannot be found without looking at every chunk — and what says so is
    /// `TranscriptReadCostTests` comparing it against the file's own size: one pass, never two.
    private(set) var bytesScanned = 0
    /// Bytes actually PARSED — the lines a marker matched. What the two ends cost is the figure to
    /// compare it against, and this is the smaller of the two by a factor of five.
    private(set) var bytesKept = 0

    /// Scan one transcript. A file that cannot be opened has no plan writes to find, which is the
    /// same answer as a file that made none: the row keeps whatever the bounded read gave it.
    ///
    /// `async` and yielding between chunks, because this walks a whole file on a pool shared with
    /// every other reader: a sweep of a week's transcripts would otherwise park a thread per file
    /// for the length of that file.
    static func scanning(_ url: URL) async -> TranscriptPlanScan {
        var scan = TranscriptPlanScan()
        guard let handle = try? FileHandle(forReadingFrom: url) else { return scan }
        defer { try? handle.close() }
        var carry = Data()
        while true {
            let read: Data?
            do {
                read = try handle.read(upToCount: chunkByteLimit)
            } catch {
                // A read that THREW is not the end of the file, and a fold that stopped early is a
                // shorter list rather than an older one. So the failure takes the plan with it
                // instead of reporting what it had reached — which is the exact reading this scan
                // exists to prevent (#1594). `nil` and empty below ARE the end, and keep it.
                scan.plan = nil
                return scan
            }
            guard let chunk = read, !chunk.isEmpty else { break }
            scan.bytesScanned += chunk.count
            carry.append(chunk)
            carry = scan.remainder(afterFolding: carry)
            await Task.yield()
        }
        // The file's last record carries no trailing newline while it is still being written.
        // Reading it costs one marker check and can only add the newest write, so it is read here
        // rather than left to the tail.
        scan.fold(carry)
        return scan
    }

    /// Every complete line in hand, folded; the record still being written is handed back to be
    /// finished by the next chunk. Cut on the same rule as `TranscriptLineSplit` — the last element
    /// is only a line if the data ended on a newline — and kept apart from it because that type
    /// decodes every line it cuts, which is the one cost this scan exists to avoid.
    private mutating func remainder(afterFolding data: Data) -> Data {
        var parts = data.split(separator: UInt8(ascii: "\n"), omittingEmptySubsequences: false)
        guard parts.count > 1 else { return data }
        let trailing = parts.removeLast()
        for part in parts {
            fold(part)
        }
        return Data(trailing)
    }

    /// One line, folded only if a marker says it could carry a plan write.
    private mutating func fold(_ line: Data) {
        guard Self.markers.contains(where: { line.range(of: $0) != nil }) else { return }
        bytesKept += line.count
        guard let text = String(data: Data(line), encoding: .utf8),
              let record = TranscriptRecord.parse(line: text) else { return }
        switch record {
        case let .assistant(message):
            plan = ledger.written(by: message) ?? plan
        case let .user(message):
            ledger.identify(from: message)
        case .attachment, .aiTitle, .customTitle, .lastPrompt, .queueOperation,
             .permissionMode, .unknown:
            break
        }
    }
}
