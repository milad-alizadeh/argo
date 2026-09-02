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
            FeedSurveyLine(
                survey: survey,
                isOpen: isOpen,
                open: openEvidence,
                look: { look(at: $0, in: survey) },
                current: isOpen ? selection.step : nil,
            )
        case let .gallery(gallery):
            FeedGalleryRow(gallery: gallery, open: selection.light)
        case let .skillLoaded(skill):
            SkillLoadedMarker(skill: skill, isOpen: isOpen, open: openEvidence)
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
