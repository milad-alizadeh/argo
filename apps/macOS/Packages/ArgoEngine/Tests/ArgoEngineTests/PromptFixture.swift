import Foundation

/// One prompt record carrying several pasted pictures, on disk. The one record shape that reaches
/// the reader with more than one picture in it — a tool result's own reading takes the first.
struct PromptFixture: ~Copyable {
    let url: URL

    init(pasting runs: [String]) throws {
        let images = runs.map {
            #"{"type":"image","source":{"type":"base64","data":"\#($0)","media_type":"image/png"}}"#
        }
        let line = """
        {"type":"user","uuid":"pasted","timestamp":"2026-08-01T09:00:00.000Z",\
        "message":{"role":"user","content":[{"type":"text","text":"compare these"},\
        \(images.joined(separator: ","))]}}
        """
        self.url = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("argo-pasted-\(UUID().uuidString).jsonl")
        try (line + "\n").write(to: url, atomically: true, encoding: .utf8)
    }

    deinit { try? FileManager.default.removeItem(at: url) }
}
