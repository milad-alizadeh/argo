@testable import ArgoEngine
import Foundation
import Testing

/// What a record's `usage` object comes to — and the two absences it has to keep apart (#1249).
///
/// The shape is verbatim from a `claude` transcript: `usage` is the MESSAGE's object, and a record
/// the CLI wrote itself carries all four keys explicitly at zero.
@Suite("Usage reading")
struct UsageReadingTests {
    private func events(_ usage: String?) async -> [TranscriptEvent] {
        let field = usage.map { "\"usage\": \($0), " } ?? ""
        let line = """
        {"type": "assistant", "message": {"role": "assistant", \(field)\
        "content": [{"type": "text", "text": "hi"}]}, "uuid": "u", \
        "cwd": "/tmp/argo", "sessionId": "s"}
        """
        return await TranscriptReader().read(line: line)
    }

    /// Just the spend events, as the readings they carry. `compactMap` over one pattern: what
    /// this asks is whether an event is a spend, which is an open condition rather than a fold
    /// over every event kind.
    private func spends(_ events: [TranscriptEvent]) -> [UsageReading] {
        events.compactMap { event in
            guard case let .usage(reading) = event else { return nil }
            return reading
        }
    }

    @Test
    func `a record carrying no usage object reports no spend at all`() async {
        #expect(await spends(events(nil)).isEmpty)
    }

    /// Every term is added: a cached token is a cheaper token, not a smaller one.
    @Test
    func `the four token fields are read as one spend`() async {
        let read = await events("""
        {"input_tokens": 10, "output_tokens": 20, \
        "cache_read_input_tokens": 200, "cache_creation_input_tokens": 30}
        """)

        #expect(spends(read) == [.read(Usage(
            inputTokens: 10,
            outputTokens: 20,
            cacheReadTokens: 200,
            cacheCreationTokens: 30,
        ))])
    }

    /// A `<synthetic>` record's own shape. It is a READING of zero, not a gap: the CLI wrote the
    /// record itself and made no request, and every key is there and says so.
    @Test
    func `four explicit zeros are a spend of nothing, not an unreadable one`() async {
        let read = await events("""
        {"input_tokens": 0, "output_tokens": 0, \
        "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0}
        """)

        #expect(spends(read) == [.read(Usage(
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
        ))])
    }

    /// One term is enough: a spend with the rest at zero is still a spend.
    @Test
    func `an object naming one term Argo knows is read, with the rest at zero`() async {
        let read = await events("{\"cache_read_input_tokens\": 90000}")

        #expect(spends(read) == [.read(Usage(
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 90000,
            cacheCreationTokens: 0,
        ))])
    }

    /// The one thing the header words `unknown`: an object Argo read and could not take a single
    /// token off — the host's keys moved, or this is not the shape a spend is written in.
    @Test
    func `an object naming no term Argo knows is unreadable, never a spend of zero`() async {
        #expect(await spends(events("{\"tokens_used\": 400}")) == [.unreadable])
        #expect(await spends(events("{}")) == [.unreadable])
    }
}
