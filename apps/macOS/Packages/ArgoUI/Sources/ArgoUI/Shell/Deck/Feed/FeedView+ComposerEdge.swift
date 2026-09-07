import ArgoDesign
import Foundation
import SwiftUI

// The reading's bottom edge under the composer.

extension FeedView {
    /// The bottom edge under a composer: rows run beneath the vessel and fade before they reach
    /// it, never clipped by it. Fully opaque when nothing floats there — the mask stays applied
    /// either way, because a modifier that comes and goes takes the scroll state with it.
    var fade: some View {
        VStack(spacing: ArgoSpacing.flush) {
            Color.black
            if bottomEdge.hasVessel {
                LinearGradient(
                    colors: [.black, .clear],
                    startPoint: .top,
                    endPoint: .bottom,
                )
                .frame(height: ArgoComposerVessel.feedFadeHeight)
                Color.clear.frame(height: ArgoComposerVessel.feedClearHeight)
            }
        }
    }

    /// The user's own words coming back as a row — the echo that is the send's acceptance, marked
    /// with the accent wash. Only the Turn THIS window typed takes it.
    func washArrived(between was: FeedFact<String?>, and now: FeedFact<String?>) {
        switch Self.wash(from: was, to: now, in: rows) {
        case .keep: return
        case .clear: washed = nil
        case let .onto(row): washed = row
        }
    }

    /// The Turn this window has typed that no record has answered yet, read off the rows the feed
    /// already holds — see `FeedProjection.submittedRow` and `HubSession.unansweredTurn`. One row
    /// or none, by construction.
    ///
    /// The whole of what the wash is decided on. It is DIRECT: Argo performed the submit, so a row
    /// standing here is proof this window sent those words, and nothing else in the feed is.
    static func sent(in rows: [FeedRow]) -> String? {
        for row in rows.reversed() {
            if case let .submitted(text) = row.content {
                return text
            }
        }
        return nil
    }

    /// What the wash does about a change in the Turn this window has out. A decision out of the
    /// view, because the view cannot be asked one: `washed` is `@State`.
    ///
    /// Another READING is never an arrival, however many rows it brought: the wash means *what you
    /// just sent landed*, and one drawn on a Session the reader has only opened is a lie. So it
    /// leaves with the reading that earned it.
    ///
    /// Nor is a READ one. A row-count delta cannot tell rows that arrived because the reader sent
    /// something from rows that arrived because Argo read something, and selecting a Session is the
    /// second kind: `Hub.readSelected(sessionID:)` fills in the stretch the bounded read skipped,
    /// under the same reading id (#1569). So the delta this reads is the SUBMISSION's: a Turn Argo
    /// typed leaving, which happens exactly once per send and never on a read.
    ///
    /// The words say which row rather than the position, and no match washes nothing: a submission
    /// also ends when a Turn is reported lost, and there is then nothing in the record it landed
    /// on. Ambiguity resolves to the quieter claim.
    static func wash(
        from was: FeedFact<String?>,
        to now: FeedFact<String?>,
        in rows: [FeedRow],
    )
        -> FeedWash {
        guard was.reading == now.reading else { return .clear }
        guard let sent = was.value, sent != now.value else { return .keep }
        guard let echoed = rows.last(where: { echoes(sent, in: $0) }) else { return .keep }
        return .onto(echoed.id)
    }

    /// Whether this row is the record's answer to those words. Trimmed on both sides: what goes
    /// down the PTY carries the submit's own newline, and the record holds the prompt without it.
    private static func echoes(_ sent: String, in row: FeedRow) -> Bool {
        let words = sent.trimmingCharacters(in: .whitespacesAndNewlines)
        // Nothing verbatim to match on, so nothing is claimed: a wordless prompt row carries the
        // empty string (`FeedRowKind`), and matching against it would wash a run of pasted
        // pictures for a send that had none.
        guard !words.isEmpty else { return false }
        let kind = row.kind
        guard kind.isPrompt else { return false }
        return kind.words?.trimmingCharacters(in: .whitespacesAndNewlines) == words
    }

    /// The wash's whole lifetime: it stands for the hold and leaves.
    ///
    /// A cancelled sleep RESUMES here rather than stopping, so the clear is gated on it: a
    /// second send re-keys this task, and the superseded one clearing anyway would wipe the
    /// fresh row's wash milliseconds into its hold.
    ///
    /// A render asking for the still holds it instead: the wash is a 1.4-second state, and a still
    /// that had to be taken inside that window would come out empty as often as not.
    func washExpired() async {
        guard washed != nil, !stillsMotion else { return }
        try? await Task.sleep(for: .seconds(ArgoComposerVessel.washHold))
        guard !Task.isCancelled else { return }
        washed = nil
    }
}

/// What a change in the Turn this window has out does to the accent wash.
enum FeedWash: Equatable {
    /// Nothing landed that the reader sent, so whatever stands goes on standing.
    case keep
    /// Another reading — the wash belonged to the one that left.
    case clear
    /// The row the record answered this window's own Turn with.
    case onto(FeedRow.ID)
}
