import ArgoEngine
import ArgoFixtures
import Foundation
import Testing

/// The fixture every gate over a settled document runs on: a synthetic of the largest Session this
/// cockpit is judged against, checked in because the Session itself never can be (ADR-0030).
///
/// `.serialized` because each case holds the whole fixture in memory, and the runner would
/// otherwise hold three copies of it at once.
@Suite("Settled session fixture", .serialized)
struct SettledSessionFixtureTests {
    /// The fixture is a transcript, so it is read the way one is: the same reader, the same
    /// projection, no branch anywhere for its being a fixture.
    @Test
    func `the synthetic projects to the rows its shape records`() async throws {
        let shape = try #require(SettledSessionFixture.shape)
        let held = try await SettledSessionReading.shape(of: Self.lines())

        #expect(SettledSessionReading.named(["rows"], in: held)
            .differences(against: SettledSessionReading.named(["rows"], in: shape)).isEmpty)
    }

    /// The records themselves, which is the half of the shape the rows are projected from: a
    /// fixture that had lost a record kind or a line of output would project the same rows off a
    /// document of another size.
    @Test
    func `the synthetic holds the records its shape records`() throws {
        let shape = try #require(SettledSessionFixture.shape)
        let named = ["records", "blocks", "tools", "text"]
        let held = try SyntheticShape(lines: Self.lines())

        #expect(held.differences(against: SettledSessionReading.named(named, in: shape)).isEmpty)
    }

    /// No real prose survives — every string in the file, KEYS INCLUDED, is either lorem or a fact
    /// the pass names as one it keeps.
    ///
    /// Walked rather than inferred from the pass being a fixed point, which is what this case used
    /// to be: anything copied through verbatim is a fixed point too, so that shape of the claim
    /// could not fail for the one class of content that leaks. A question keyed into `answers` is
    /// how it leaked.
    @Test
    func `every string the synthetic carries is lorem or a fact the pass keeps`() throws {
        let kept = SyntheticTranscript.verbatim
            .union(SyntheticTranscript.identifying)
            .union(SyntheticTranscript.pixels)
        var real: [String] = []

        for line in try Self.lines() {
            guard let data = line.data(using: .utf8),
                  let record = try? JSONSerialization.jsonObject(with: data) else { continue }
            for held in SettledSessionReading.strings(in: record) {
                // A key spelled as a schema name is the schema's word rather than anybody's — it
                // is the sentence-shaped ones that carry what somebody wrote.
                if held.key == nil, SyntheticTranscript.isSchemaName(held.text) {
                    continue
                }
                guard !kept.contains(held.key ?? ""), !SyntheticTranscript.isSynthetic(held.text),
                      !SyntheticTranscript.sentences
                      .contains(held.text.trimmingCharacters(in: .whitespacesAndNewlines))
                else { continue }
                real.append("\(held.key ?? "<key>"): \(held.text.prefix(80))")
            }
        }

        #expect(real.isEmpty, "\(real.prefix(5))")
    }

    /// What the case above is allowed to let past, restated here so that widening the pass's own
    /// lists is a decision somebody has to make twice.
    @Test
    func `the pass keeps only the fields it is named for keeping`() {
        #expect(SyntheticTranscript.verbatim == [
            "type", "subtype", "role", "name", "model", "stop_reason", "status", "level",
            "permissionMode", "mode", "entrypoint", "userType", "version", "media_type",
            "timestamp", "gitBranch",
        ])
        #expect(SyntheticTranscript.identifying == [
            "id", "uuid", "parentUuid", "leafUuid", "sessionId", "session_id", "tool_use_id",
            "toolUseId", "toolUseID", "messageId", "requestId", "promptId", "bridgeSessionId",
            "ownerAccountUuid", "ownerOrganizationUuid", "agentId", "sourceToolAssistantUUID",
        ])
        #expect(SyntheticTranscript.pixels == ["data", "base64"])
        // Both spellings, spelled out like every list above it: the `for tool use` half is 99 of
        // this machine's 532 real markers, and scrambled it draws as a prompt row (#1189).
        #expect(SyntheticTranscript.sentences == [
            "[Request interrupted by user]",
            "[Request interrupted by user for tool use]",
        ])
        // The markers are on this list for the same reason and were the likelier omission: the
        // rule that keeps them is what carried a tool's own `<hosted-invoice-url>` through.
        #expect(SyntheticLorem.markers == [
            "task-notification", "result", "event", "summary", "status", "tool-use-id", "task-id",
            "command-name", "command-message", "command-args", "local-command-stdout",
        ])
    }

    /// The pass over its own output is the same output — what makes a regeneration of an
    /// already-synthetic file a no-op, and the id minting a function of the file.
    @Test
    func `synthesising the synthetic again changes nothing in it`() throws {
        let held = try Self.lines()
        var pass = SyntheticTranscript()
        let again = pass.synthesised(lines: held)
        // The first record that moved rather than the two readings: an expectation over the whole
        // fixture prints the whole fixture when it fails.
        let moved = held.indices.first { at in at >= again.count || held[at] != again[at] }

        #expect(again.count == held.count)
        #expect(moved == nil, "record \(moved ?? 0) is not already synthetic")
    }

    /// The same claim at the seam, where the words are known — and where a question is a KEY.
    @Test
    func `a record's own words do not survive synthesis`() {
        var pass = SyntheticTranscript()

        let synthetic = pass.synthesised(line: Self.asked)

        for word in ["deploy", "staging", "cluster", "tonight", "a-record", "milaadd", "amex"] {
            #expect(!synthetic.contains(word), "\(word) survived")
        }
    }

    /// And the record still IS what it was, or it stands for nothing.
    @Test
    func `a synthesised record keeps the fields its reading branches on`() throws {
        var pass = SyntheticTranscript()

        let data = try #require(pass.synthesised(line: Self.asked).data(using: .utf8))
        let record = try #require(
            try JSONSerialization.jsonObject(with: data) as? [String: Any],
        )
        let message = record["message"] as? [String: Any]

        #expect(record["type"] as? String == "user")
        #expect(message?["role"] as? String == "user")
    }

    /// A prompt, and an answer filed under the question that was asked — the shape that put a real
    /// sentence in a key.
    private static let asked = """
    {"type":"user","uuid":"a-record","message":{"role":"user","content":"deploy the staging \
    cluster tonight"},"toolUseResult":{"answers":{"Which milaadd amex account?":"the second"}}}
    """

    private static func lines() throws -> [String] {
        try SettledSessionReading.lines(of: SettledSessionFixture.synthetic)
    }
}
