@testable import ArgoEngine
import Foundation
import Testing

// Following a file that is still being written. These exercise the two hazards: a record can be
// half-written when the watcher fires, and a file can be replaced under an open handle.

@Suite("Transcript tail")
struct TranscriptTailTests {
    /// A scratch file that cleans itself up, and the writes a live agent makes to it.
    private struct ScratchFile: ~Copyable {
        let url: URL

        init(_ contents: String = "") throws {
            self.url = URL(fileURLWithPath: NSTemporaryDirectory())
                .appendingPathComponent("argo-tail-\(UUID().uuidString).jsonl")
            try contents.write(to: url, atomically: true, encoding: .utf8)
        }

        func append(_ text: String) throws {
            let handle = try FileHandle(forWritingTo: url)
            defer { try? handle.close() }
            try handle.seekToEnd()
            try handle.write(contentsOf: Data(text.utf8))
        }

        deinit { try? FileManager.default.removeItem(at: url) }
    }

    /// The lines the tail yields up to the first read that reaches `count`, or whatever arrived
    /// before the deadline. A read is a batch, so the answer can overshoot `count`.
    private func firstLines(
        _ count: Int,
        of url: URL,
        timeout: Duration = .seconds(5),
    ) async
        -> [String] {
        await withTaskGroup(of: [String]?.self) { group in
            group.addTask {
                var lines: [String] = []
                for await batch in transcriptLines(at: url) {
                    lines.append(contentsOf: batch.map(\.text))
                    if lines.count >= count {
                        return lines
                    }
                }
                return lines
            }
            group.addTask {
                try? await Task.sleep(for: timeout)
                return nil
            }
            let first = await group.next().flatMap(\.self)
            group.cancelAll()
            return first ?? []
        }
    }

    @Test
    func `Lines already in the file are read without waiting for a write`() async throws {
        let file = try ScratchFile("{\"type\": \"ai-title\", \"aiTitle\": \"first\"}\n")

        let lines = await firstLines(1, of: file.url)

        // The watcher only reports what happens NEXT, so a transcript that is never appended to
        // again would otherwise never be read at all.
        #expect(lines == ["{\"type\": \"ai-title\", \"aiTitle\": \"first\"}"])
    }

    /// The backfill batch is what tells a consumer the file has been READ, so an empty file has to
    /// deliver one too, or its Session is a roster row nobody may draw.
    @Test(.timeLimit(.minutes(1)))
    func `An empty transcript still reports that it has been read`() async throws {
        let file = try ScratchFile()

        var batches: [[String]] = []
        for await batch in transcriptLines(at: file.url) {
            batches.append(batch.map(\.text))
            break
        }

        #expect(batches == [[]])
    }

    @Test
    func `A line appended after the tail started arrives`() async throws {
        let file = try ScratchFile("{\"type\": \"ai-title\", \"aiTitle\": \"first\"}\n")

        async let tailed = firstLines(2, of: file.url)
        try await Task.sleep(for: .milliseconds(150))
        try file.append("{\"type\": \"ai-title\", \"aiTitle\": \"second\"}\n")

        #expect(await tailed.count == 2)
        #expect(await tailed.last == "{\"type\": \"ai-title\", \"aiTitle\": \"second\"}")
    }

    @Test
    func `A half-written record is carried, not parsed`() async throws {
        let file = try ScratchFile()

        async let tailed = firstLines(1, of: file.url)
        try await Task.sleep(for: .milliseconds(150))
        // The agent is mid-write: the watcher fires on this, and the bytes are not yet a record.
        try file.append("{\"type\": \"ai-ti")
        try await Task.sleep(for: .milliseconds(150))
        try file.append("tle\", \"aiTitle\": \"whole\"}\n")

        // One line, assembled — never two halves, and never a spurious unreadable line for a file
        // that is perfectly well-formed a millisecond later.
        #expect(await tailed == ["{\"type\": \"ai-title\", \"aiTitle\": \"whole\"}"])
    }
}
