@testable import ArgoEngine
import Testing

/// What a transcript says about what it cost. Two grains, and the whole difficulty is that they
/// overlap: a subagent's own records are in the same file as its parent's, and counting both is
/// counting the delegated work twice.
@Suite("Spend reading")
struct SpendReadingTests {
    private func spends(in name: String) async throws -> [Usage] {
        try await Fixture.events(name).compactMap { event in
            guard case let .usage(usage) = event else { return nil }
            return usage
        }
    }

    /// Every request is priced on its own, so a record that carries a `usage` object is one term of
    /// what the Session spent.
    @Test
    func `a record that priced itself is read as a spend`() async throws {
        #expect(try await spends(in: "askOffered") == [Usage(
            inputTokens: 5000,
            outputTokens: 120,
            cacheReadTokens: 80000,
            cacheCreationTokens: 0,
        )])
    }

    /// The sidechain record in that fixture reports 900 in and 80 out, and neither figure appears:
    /// that spend is the subagent's, and the delegating call's result already carries it whole.
    @Test
    func `a subagent's own record is not counted a second time`() async throws {
        #expect(try await spends(in: "askOffered").allSatisfy { $0.inputTokens != 900 })
    }
}
