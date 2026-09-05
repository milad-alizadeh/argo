import SwiftUI

/// One row of the reading, drawn as what it is.
///
/// The keyboard half lives beside it as `FeedRow.activate` rather than on the view: the rows are
/// hosted per table cell now, so the key arrives at the TABLE, and the answer — what Return does
/// to this row — has to be callable without the view that would draw it.
struct FeedRowView: View {
    let row: FeedRow
    @Binding var isExpanded: Bool
    let selection: FeedRowSelection

    var body: some View {
        switch row.content {
        case let .prompt(text, shots):
            FeedPrompt(text: text, shots: shots, open: selection.light, isExpanded: $isExpanded)
        case let .message(markdown): FeedProse(text: markdown, voice: .message)
        case let .thought(markdown): FeedProse(text: markdown, voice: .thought)
        case let .call(call):
            FeedCallLine(call: call, isOpen: isOpen, open: openEvidence)
        case let .survey(survey):
            FeedFoldLine(fold: survey, opening: opening)
        case let .work(work):
            FeedFoldLine(fold: work, opening: opening)
        case let .gallery(gallery):
            FeedGalleryRow(gallery: gallery, open: selection.light)
        case let .skillLoaded(skill):
            SkillLoadedMarker(skill: skill, isOpen: isOpen, open: openEvidence)
        // Identified by the QUESTION and not by the cell: the rows are hosted in a recycled
        // `NSTableView` cell, so a view whose marks lived on cell identity alone would carry one
        // question's ticks into the next question that landed there (#712).
        case let .ask(ask): FeedAskLine(ask: ask).id(ask.identity)
        case let .mark(mark): FeedMarkLine(mark: mark)
        case let .settledWait(settled): FeedWaitRow(settled: settled)
        case let .delegationEnded(end): FeedDelegationEndRow(end: end)
        case let .unreadable(unreadable):
            FeedUnreadableLine(unreadable: unreadable, isExpanded: $isExpanded)
        }
    }

    private var isOpen: Bool {
        selection.open == row.id
    }

    /// How a folded row stands: whether the reader has its list out, and which of the listed calls
    /// the pane is showing. The line is an accordion and the names in it are what open the panel —
    /// see `FeedFoldOpening`.
    private var opening: FeedFoldOpening {
        FeedFoldOpening(
            isExpanded: isExpanded,
            // Through `activate` and not a toggle of its own, so the click and the key stay the one
            // answer the doc there claims they are.
            expand: { row.activate(selection: selection, isExpanded: $isExpanded) },
            look: look,
            current: isOpen ? selection.step : nil,
        )
    }

    private func openEvidence() {
        row.openEvidence(with: selection)
    }

    /// Open the panel at what one of a folded run's calls produced — by the step's place down the
    /// whole pane, which is what the list already carries.
    private func look(at step: Int) {
        selection.openEvidence(of: row.id, at: step)
    }
}

extension FeedRow {
    /// What Return or Space does to this row, which is exactly what a click on it does. Switched
    /// over the four intents `FeedRow.Content.kind` resolves rather than over the ten kinds, so
    /// which row means which intent is decided in one place and not here.
    ///
    /// A row with nothing to open answers `false` rather than swallowing the key — prose, a
    /// gallery of absences, and a call the record never answered alike.
    @discardableResult
    func activate(selection: FeedRowSelection, isExpanded: Binding<Bool>) -> Bool {
        let kind = content.kind
        switch kind.activation {
        case .fold:
            isExpanded.wrappedValue.toggle()
            return true
        case .openEvidence:
            guard selection.open == id || kind.opensEvidence else { return false }
            openEvidence(with: selection)
            return true
        case let .light(shot):
            selection.light(shot)
            return true
        case .inert:
            return false
        }
    }

    /// A second press on the open row closes it: the row is the control, so it is also the way out.
    ///
    /// A row with nothing behind it opens nothing at all, rather than marking itself as the open
    /// row over a panel that has nothing to show.
    func openEvidence(with selection: FeedRowSelection) {
        guard selection.open != id else { return selection.close() }
        guard kind.opensEvidence else { return }
        selection.openEvidence(of: id)
    }
}

// Every kind a row can be, drawn through the one view that decides which. Taken from the shipping
// projection, so nothing here is a shape the feed would never produce.
