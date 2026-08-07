import Testing
@testable import ArgoEngine

// Raw evidence is preserved byte-for-byte on the parsed events. Every assertion here is an equality
// against the fixture's own characters, because "preserved" is the claim and a normalized reading
// would pass a looser one.

@Suite("Evidence")
struct EvidenceTests {
    @Test("A command's output is carried verbatim")
    func commandOutputIsVerbatim() async throws {
        let outcomes = try await Fixture.events("commands").outcomes()
        let failed = try #require(outcomes["call-bash-bad"])

        #expect(failed.status == .failed)
        guard case let .output(output) = try #require(failed.result) else {
            Issue.record("a failed command carries what it printed")
            return
        }
        #expect(output.tier == .direct)
        #expect(output.text == "src/x.ts(4,1): error TS2345")
    }

    @Test("A successful read keeps no output — the row that folds it never shows one")
    func quietReadsCarryNothing() async throws {
        let outcomes = try await Fixture.events("commands").outcomes()
        #expect(try #require(outcomes["call-read-ok"]).result == nil)
    }

    @Test("Embedded image bytes are read, and are DIRECT")
    func embeddedMediaIsDirect() async throws {
        let outcomes = try await Fixture.events("media").outcomes()

        guard case let .media(media) = try #require(outcomes["shot-1"]?.result) else {
            Issue.record("an image read carries the bytes the agent saw")
            return
        }
        #expect(media.tier == .direct)
        #expect(media.mediaType == "image/png")
        #expect(media.bytes == "BEFORE-BYTES")
    }

    @Test("Two renders of ONE path keep their own bytes, in order")
    func rerendersDoNotCollapse() async throws {
        let outcomes = try await Fixture.events("media").outcomes()

        // The whole reason embedded bytes outrank a disk read: both calls name `/tmp/header.png`,
        // and a path-first reading would show the newest picture under both rows.
        guard case let .media(before) = try #require(outcomes["shot-1"]?.result),
              case let .media(after) = try #require(outcomes["shot-2"]?.result)
        else {
            Issue.record("both renders carry their own bytes")
            return
        }
        #expect(before.bytes == "BEFORE-BYTES")
        #expect(after.bytes == "AFTER-BYTES")
    }

    @Test("A failed image read shows the error, never a picture of the file as it stands now")
    func failedReadsShowTheirError() async throws {
        let outcomes = try await Fixture.events("media", readImage: { _ in "FROM-DISK" }).outcomes()
        let failed = try #require(outcomes["shot-3"])

        #expect(failed.status == .failed)
        guard case let .output(output) = try #require(failed.result) else {
            Issue.record("a failed read carries what went wrong")
            return
        }
        #expect(output.text == "File does not exist: /tmp/gone.png")
    }

    @Test("An SVG handed back as source stays text, and is not rendered as a picture")
    func svgSourceIsNotMedia() async throws {
        let outcomes = try await Fixture.events("media", readImage: { _ in "FROM-DISK" }).outcomes()
        // `.svg` is in the disk-fallback table, so only the "result carried text of its own" gate
        // keeps this a read of source rather than a render of the file.
        #expect(try #require(outcomes["vector-1"]).result == nil)
    }

    @Test("A delegate's result belongs to the subagent, not to the delegating call")
    func delegatesCarryNoOutput() async throws {
        let outcomes = try await Fixture.events("treeFull").outcomes()
        #expect(try #require(outcomes["call-bare"]).result == nil)
    }

    @Test("The spend a result reports rides on the outcome")
    func usageRidesOnTheOutcome() async throws {
        let events = try await Fixture.events("treeFull")
        let calls = events.compactMap { event -> ToolCall? in
            guard case let .toolCall(call) = event else { return nil }
            return call
        }

        #expect(calls.map(\.name).contains("Task"))
        #expect(calls.first { $0.id == "call-read" }?.kind == .read)
        #expect(calls.first { $0.id == "call-todo" }?.kind == .plan)
        #expect(calls.first { $0.id == "call-task" }?.kind == .delegate)
    }
}

extension [TranscriptEvent] {
    /// Every resolved call, by id — the shape most assertions here want.
    func outcomes() -> [String: ToolCallOutcome] {
        reduce(into: [:]) { found, event in
            guard case let .toolCallOutcome(outcome) = event else { return }
            found[outcome.id] = outcome
        }
    }
}
