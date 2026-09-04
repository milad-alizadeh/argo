@testable import ArgoEngine
import Foundation
import Testing

/// The model as the record reports it, and the one shape of value that is not a model at all
/// (#1223).
///
/// `model` sits on the MESSAGE, unlike `effort` beside it — the host files it as a fact about the
/// reply. On a record the CLI wrote itself rather than got from a provider, the field holds
/// `<synthetic>`: the host's own placeholder for "no model answered this". Verbatim from a
/// `claude` 2.1.257 transcript, on a record also carrying `"isApiErrorMessage": true`.
@Suite("Model reading")
struct ModelReadingTests {
    private func ids(_ events: [TranscriptEvent]) -> [String] {
        events.compactMap { event in
            guard case let .model(id) = event else { return nil }
            return id
        }
    }

    private func line(model: String?, uuid: String = "u") -> String {
        let field = model.map { "\"model\": \"\($0)\", " } ?? ""
        return """
        {"type": "assistant", "message": {"role": "assistant", \(field)\
        "content": [{"type": "text", "text": "hi"}]}, "uuid": "\(uuid)", \
        "cwd": "/tmp/argo", "sessionId": "s"}
        """
    }

    @Test
    func `the CLI's own id is read verbatim`() async {
        let read = await ids(TranscriptReader().read(line: line(model: "claude-opus-5")))

        #expect(read == ["claude-opus-5"])
    }

    /// An id this Argo's table has never heard of is exactly the id a newer CLI knows (#558), so
    /// the guard below must be about the SHAPE of the value and never a list of known models.
    @Test
    func `an id off Argo's own table is read anyway`() async {
        let read = await ids(TranscriptReader().read(line: line(model: "claude-mythos-6")))

        #expect(read == ["claude-mythos-6"])
    }

    /// The bug. A placeholder reached the composer's model picker as a pickable row, and a resume
    /// then put it on `--model` — where no such model exists, so every turn failed and no turn
    /// could write the real reading that would have replaced it.
    @Test(arguments: ["<synthetic>", "<unknown>", "", "   "])
    func `a placeholder is not a model reading`(placeholder: String) async {
        let read = await ids(TranscriptReader().read(line: line(model: placeholder)))

        #expect(read.isEmpty)
    }

    /// The reading a placeholder must not cost. Argo keeps the LATEST model it read, so a synthetic
    /// record landing between two real ones has to leave that reading alone rather than replace it.
    @Test
    func `a placeholder between two real readings changes nothing`() async {
        let reader = TranscriptReader()
        let lines = [
            line(model: "claude-opus-5", uuid: "u1"),
            line(model: "<synthetic>", uuid: "u2"),
            line(model: "claude-opus-5", uuid: "u3"),
        ]

        let read = await ids(reader.read(lines: lines))

        #expect(read == ["claude-opus-5"])
    }

    /// And the next REAL model still announces itself — skipping a placeholder must not also make
    /// the reader think it has already said what comes after it.
    @Test
    func `a real id after a placeholder is announced`() async {
        let reader = TranscriptReader()
        let lines = [
            line(model: "claude-opus-5", uuid: "u1"),
            line(model: "<synthetic>", uuid: "u2"),
            line(model: "claude-sonnet-5", uuid: "u3"),
        ]

        let read = await ids(reader.read(lines: lines))

        #expect(read == ["claude-opus-5", "claude-sonnet-5"])
    }

    @Test
    func `a record carrying no model announces none`() async {
        let read = await ids(TranscriptReader().read(line: line(model: nil)))

        #expect(read.isEmpty)
    }
}
