import ArgoEngine
@testable import ArgoUI
import Testing

/// What the feed says about a Permission the gate refused when nobody answered it (#573).
///
/// Its own suite for `FeedHandoffTests`'s reason: this is the second input to the feed that is not
/// the record.
@Suite("Feed permission expiry")
struct FeedPermissionExpiryTests {
    /// The study's own sentence, both halves of it: `denied` alone would credit a decision nobody
    /// made.
    @Test
    func `the row says both halves of what happened, in the study's words`() {
        #expect(
            FeedMark.permissionExpired(Self.expiry).words
                == "Permission expired — denied, unanswered",
        )
    }

    /// The tool is named to a screen reader and nowhere else: on the rule it would push the
    /// sentence past the column.
    @Test
    func `a screen reader is told which call it was`() {
        #expect(
            FeedMark.permissionExpired(Self.expiry).spoken
                == "Permission for Bash expired — denied, unanswered",
        )
    }

    /// Above the roll-up and below the work, and it leads nowhere — the handoff link stays the one
    /// pressable row in the feed.
    @Test
    func `the row sits under the work and above what the Session spent`() {
        let rows = FeedProjection.rows(from: Self.transcript, expired: [Self.expiry])

        #expect(rows.last?.content == .mark(.spent(Self.spend)))
        #expect(rows.dropLast().last?.content == .mark(.permissionExpired(Self.expiry)))
        #expect(FeedMark.permissionExpired(Self.expiry).handoff == nil)
    }

    /// One row per expiry, in the order they ran out — never a count.
    @Test
    func `two calls that expired are two rows, oldest first`() {
        let second = PermissionExpiry(id: "permission-2", toolName: "Write")
        let rows = FeedProjection.rows(from: Self.transcript, expired: [Self.expiry, second])

        #expect(rows.compactMap(\.content.expiry) == [Self.expiry, second])
    }

    /// The empty case is every Session in the app: the gate waits a day, so nothing expires unless
    /// somebody walked away from a running agent for one.
    @Test
    func `a Session that lost no call reads exactly as it did before`() {
        let rows = FeedProjection.rows(from: Self.transcript)

        #expect(rows.last?.content == .mark(.spent(Self.spend)))
        #expect(rows.allSatisfy { $0.content.expiry == nil })
    }

    private static let expiry = PermissionExpiry(id: "permission-1", toolName: "Bash")

    private static let spend = Usage(
        inputTokens: 12,
        outputTokens: 34,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
    )

    private static let transcript: [TranscriptEvent] = [
        .prompt(text: "Clear the build folder", images: [], atMs: 1000),
        .message(markdown: "Running that now."),
        .turnEnded(.endTurn),
        .usage(spend),
    ]
}

private extension FeedRow.Content {
    var expiry: PermissionExpiry? {
        guard case let .mark(.permissionExpired(expiry)) = self else { return nil }
        return expiry
    }
}
