@testable import ArgoEngine
import Testing

// The boundary's own claim: a model wrote the file, so nothing in it is trusted to have the shape
// it should — and the reader answers every shape rather than throwing on the ones it dislikes.

@Suite("Untrusted input")
struct UntrustedInputTests {
    @Test
    func `A line that is not a JSON object reads as unreadable, keeping its bytes`() async throws {
        let events = try await Fixture.events("unparseableBody")
        let unreadable = events.compactMap { event -> String? in
            guard case let .unreadableLine(raw) = event else { return nil }
            return raw
        }

        // `{not json`, `[]`, `"a string"`, `null`, `{"type":"user"` — five lines, none of them a
        // record, none of them silently dropped.
        #expect(unreadable == ["{not json", "[]", "\"a string\"", "null", "{\"type\":\"user\""])
    }

    @Test
    func `A malformed line never stops the ones after it`() async throws {
        let events = try await Fixture.events("unparseableBody")
        // The fixture's first two lines are a readable head-leaf and an attachment; the garbage
        // follows. Both survive alongside it.
        #expect(events.contains(.headLeaf(uuid: "b-root-1")))
        #expect(events.contains(.cwd("/Users/x/tree")))
    }

    @Test
    func `A content part whose own field is the wrong type is dropped, not the record`(
    ) async throws {
        let events = try await Fixture.events("prose")
        let messages = events.compactMap { event -> String? in
            guard case let .message(markdown) = event else { return nil }
            return markdown
        }

        // The record carries `{"type": "text", "text": 12}`, a `thinking` with no text and a `text`
        // with no text, then a real one. Only the real one is read, and the record survives.
        #expect(messages.contains("survived the malformed neighbours"))
        #expect(!messages.contains(""))
    }

    @Test
    func `Blank prose is nothing said, not an empty thing said`() async throws {
        let events = try await Fixture.events("harnessNoise")

        // Not a rare edge: a real Claude Code record carries every REDACTED thought as
        // `"thinking": ""` beside an encrypted signature, so emitting these would fill a live feed
        // with silent rows. The fixture carries both an empty one and a whitespace-only one.
        #expect(!events.contains(.thought(markdown: "")))
        #expect(!events.contains { event in
            guard case let .thought(markdown) = event else { return false }
            return markdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        })
        // And the real thought in the same fixture still arrives.
        #expect(events.contains(.thought(markdown: "The gap is asymmetric.")))
    }

    @Test
    func `An unknown record type is not an error and produces no events`() {
        let record = TranscriptRecord.parse(line: #"{"type": "bridge-session", "id": "x"}"#)
        #expect(record == .unknown(raw: #"{"type": "bridge-session", "id": "x"}"#))
    }

    @Test
    func `A blank line is punctuation, not an unreadable record`() async {
        let events = await TranscriptReader().read(lines: ["", "   "])
        #expect(events.isEmpty)
    }
}
