import ArgoDesign
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
    /// with the accent wash. Only a prompt among the ARRIVING rows takes it.
    func washArrived(between was: FeedFact<Int>, and now: FeedFact<Int>) {
        switch Self.wash(from: was, to: now, in: rows) {
        case .keep: return
        case .clear: washed = nil
        case let .onto(row): washed = row
        }
    }

    /// What the wash does about a change in the row count. A decision out of the view, because the
    /// view cannot be asked one: `washed` is `@State`.
    ///
    /// Another READING is never an arrival, however many rows it brought: the wash means *what you
    /// just sent landed*, and one drawn on a Session the reader has only opened is a lie. So it
    /// leaves with the reading that earned it.
    static func wash(
        from was: FeedFact<Int>,
        to now: FeedFact<Int>,
        in rows: [FeedRow],
    )
        -> FeedWash {
        guard was.reading == now.reading else { return .clear }
        guard now.value > was.value, now.value <= rows.count else { return .keep }
        guard let echoed = rows[was.value ..< now.value].last(where: \.kind.isPrompt) else {
            return .keep
        }
        return .onto(echoed.id)
    }

    /// The wash's whole lifetime: it stands for the hold and leaves.
    ///
    /// A cancelled sleep RESUMES here rather than stopping, so the clear is gated on it: a
    /// second send re-keys this task, and the superseded one clearing anyway would wipe the
    /// fresh row's wash milliseconds into its hold.
    func washExpired() async {
        guard washed != nil else { return }
        try? await Task.sleep(for: .seconds(ArgoComposerVessel.washHold))
        guard !Task.isCancelled else { return }
        washed = nil
    }
}

/// What a change in the reading's row count does to the accent wash.
enum FeedWash: Equatable {
    /// Nothing arrived that the reader sent, so whatever stands goes on standing.
    case keep
    /// Another reading — the wash belonged to the one that left.
    case clear
    case onto(FeedRow.ID)
}
