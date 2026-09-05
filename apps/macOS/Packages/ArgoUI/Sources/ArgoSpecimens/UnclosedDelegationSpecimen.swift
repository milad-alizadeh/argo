import ArgoEngine
import ArgoFixtures
import ArgoUI
import SwiftUI

/// The state #1267 was reported from: a Session whose two review agents finished, whose reports
/// never landed, and which could not be driven again (#908, #825).
///
/// Every earlier reading of these records left the reader with a rail saying `2 running`, a Session
/// reading `running`, a field inviting a queued follow-up, and a Stop where the send arrow goes —
/// for up to the four hours `DelegationCeiling` allows. What this still has to settle is the pair:
/// the rail still says a child is out, AND the composer takes the next Turn.
///
/// The composer is DERIVED here rather than stated — `SessionComposerProjection.composer(for:)`
/// over a Session built from the records themselves. A fixture that spelled the composer's own
/// flags would render the answer instead of the reading, and prove nothing about either (#1179).
struct UnclosedDelegationSpecimen: View {
    /// Whether the reader has ENDED one of the two delegations. The other half of the ticket: the
    /// chip goes quiet, and — where every held delegation has been ended — the Session comes off
    /// `running` altogether.
    var ended: Set<String> = []

    var body: some View {
        InstrumentDeckShell(
            room: .sessions,
            feed: Self.rows,
            header: SessionHeaderFixture.header(for: .managed),
            vessel: SessionComposerProjection.composer(for: Self.session)
                .map(DeckVessel.composer) ?? .none,
            readings: readings,
        )
    }

    /// The children's own readings, so the chips are controls rather than quiet rows — and which of
    /// them the reader has ended.
    private var readings: FeedAgentReader {
        FeedAgentReader(
            events: [TranscriptFixtures.verifierID: AgentsRailFixture.verifier],
            of: .running,
            ended: ended,
        )
    }

    // MARK: - The record

    /// The two handovers, each answered by a launch receipt and by nothing else.
    static let calls = (spec: "review-spec", standards: "review-standards")

    private static let handedOver: [TranscriptEvent] = [
        .prompt(
            text: "Review the diff on both axes before the pull request opens.",
            images: [],
            atMs: 1_733_000_000_000,
        ),
        .message(markdown: "Two agents out — one on the spec, one on the standards."),
    ]
        + delegation(calls.spec, brief: "Spec axis review", minutesAgo: 50)
        + delegation(calls.standards, brief: "Standards axis review", minutesAgo: 48)

    private static let rows = FeedProjection.rows(from: handedOver, working: true)

    /// The Session as the cockpit reads it: `running`, because the record's Turn is open and
    /// nothing has closed it — which is exactly the reading the reader was stuck behind.
    private static let session: CockpitPresentation.Session = {
        var transcript = CockpitPresentation.Session.Transcript(events: handedOver)
        // After the init and not through it, as the projection sets it.
        transcript.delegationHold = DelegationHold.read(handedOver)
        return CockpitPresentation.Session(
            id: "specimen",
            title: "Review the diff",
            access: .managed,
            status: .running,
            chain: .init(program: .init(cli: .claude, model: "claude-opus-5", effort: "medium")),
            // Stated, so the footer's rung is not the one unknown on a still that is about a
            // different fact entirely.
            autonomy: .init(mode: .exactly(.code, cli: "acceptEdits")),
            transcript: transcript,
        )
    }()

    /// One backgrounded delegation as the record leaves it — the handover, and the receipt that
    /// resolves nothing. Minutes and not hours, deliberately: inside `DelegationCeiling`, so
    /// nothing here is a chip the ceiling had already quieted.
    private static func delegation(
        _ id: String,
        brief: String,
        minutesAgo: Int,
    )
        -> [TranscriptEvent] {
        [
            .toolCall(ToolCall(
                id: id,
                name: "Agent",
                kind: .delegate,
                target: brief,
                narration: brief,
                atMs: TranscriptFixtures.handedOver(minutesAgo * 60),
            )),
            .toolCallOutcome(TranscriptFixtures.launched(
                id,
                subagent: TranscriptFixtures.verifierID,
            )),
        ]
    }
}

#Preview("Unclosed delegation — the rail still says running, the composer can still send") {
    UnclosedDelegationSpecimen()
        .frame(width: 1000, height: 700)
        .argoAppearance()
}

#Preview("Unclosed delegation — one ended from the rail") {
    UnclosedDelegationSpecimen(ended: [UnclosedDelegationSpecimen.calls.spec])
        .frame(width: 1000, height: 700)
        .argoAppearance()
}
