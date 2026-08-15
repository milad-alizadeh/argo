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
        case let .prompt(text): FeedPrompt(text: text, isExpanded: $isExpanded)
        case let .message(markdown): FeedProse(text: markdown, voice: .message)
        case let .thought(markdown): FeedProse(text: markdown, voice: .thought)
        case let .call(call):
            FeedCallLine(call: call, isOpen: isOpen, open: openEvidence)
        case let .survey(survey):
            FeedSurveyLine(
                survey: survey,
                isOpen: isOpen,
                open: openEvidence,
                look: { look(at: $0, in: survey) },
                current: isOpen ? selection.step : nil,
            )
        // A gallery opens no panel — what a shot produced IS the shot, so the click goes straight
        // to the picture.
        case let .gallery(gallery):
            FeedGalleryRow(gallery: gallery, open: selection.light)
        // Identified by the QUESTION and not by the cell: the rows are hosted in a recycled
        // `NSTableView` cell, so a view whose marks lived on cell identity alone would carry one
        // question's ticks into the next question that landed there (#712).
        case let .ask(ask): FeedAskLine(ask: ask).id(ask.identity)
        case let .mark(mark): FeedMarkLine(mark: mark)
        case let .unreadable(unreadable):
            FeedUnreadableLine(unreadable: unreadable, isExpanded: $isExpanded)
        }
    }

    private var isOpen: Bool {
        selection.open == row.id
    }

    private func openEvidence() {
        row.openEvidence(with: selection)
    }

    /// Open the panel at what one of a folded run's calls produced. A call the record answered with
    /// nothing has no step to go to and the press does nothing — the control is disabled anyway,
    /// and this guard is the same fact answered where it cannot be wrong.
    private func look(at call: Int, in survey: FeedSurvey) {
        guard let step = survey.step(of: call) else { return }
        selection.openEvidence(of: row.id, at: step)
    }
}

extension FeedRow {
    /// What Return or Space does to this row, which is exactly what a click on it does.
    ///
    /// A gallery opens the FIRST picture there is anything behind; its shots are each a control of
    /// their own.
    ///
    /// A row with nothing to open answers `false` rather than swallowing the key — prose, a
    /// gallery of absences, and a call the record never answered alike. Taking the key on an inert
    /// row takes it away from the feed, which is where scrolling lives.
    @discardableResult
    func activate(selection: FeedRowSelection, isExpanded: Binding<Bool>) -> Bool {
        switch content {
        case .call, .survey:
            guard selection.open == id || opensEvidence else { return false }
            openEvidence(with: selection)
            return true
        case let .gallery(gallery):
            guard let shot = gallery.shots.first(where: \.isOpenable) else { return false }
            selection.light(shot)
            return true
        case .prompt, .unreadable:
            isExpanded.wrappedValue.toggle()
            return true
        // A question and a mark open nothing, so the key falls through to the feed.
        case .message, .thought, .ask, .mark:
            return false
        }
    }

    /// A second press on the open row closes it: the row is the control, so it is also the way out.
    ///
    /// A row with nothing behind it opens nothing at all, rather than marking itself as the open
    /// row over a panel that has nothing to show.
    func openEvidence(with selection: FeedRowSelection) {
        guard selection.open != id else { return selection.close() }
        guard opensEvidence else { return }
        selection.openEvidence(of: id)
    }
}

// Every kind a row can be, drawn through the one view that decides which. Taken from the shipping
// projection, so nothing here is a shape the feed would never produce.
#Preview("Feed rows — every kind, at rest") {
    FeedPreview(rows: FeedProjection.previewRows)
        .frame(width: 820, height: 620)
}

#Preview("Feed rows — the row whose evidence is open") {
    FeedPreview(rows: FeedProjection.previewCallRows, open: FeedProjection.previewFailedCallID)
        .frame(width: 820, height: 620)
}
