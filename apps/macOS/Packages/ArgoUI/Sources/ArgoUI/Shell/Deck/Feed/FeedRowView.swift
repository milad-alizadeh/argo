import SwiftUI

/// One row of the reading, drawn as what it is and reachable without a pointer.
///
/// The keyboard half is here rather than on each kind of row because the answer is the same for all
/// of them: the row is the target, so the row is what takes focus and what Return acts on. Spelling
/// it once also makes the rule checkable by looking — every kind either does something when you
/// press Return or is named in the arm that does nothing.
struct FeedRowView: View {
    let row: FeedRow
    @Binding var isExpanded: Bool
    let selection: FeedRowSelection

    var body: some View {
        content
            .focusable()
            .focused(selection.focus, equals: .row(row.id))
            // Return and Space both, because both are what a focused control answers to on this
            // platform and a reader should not have to learn which one this surface chose.
            .onKeyPress(.return) { activate() }
            .onKeyPress(.space) { activate() }
    }

    @ViewBuilder private var content: some View {
        switch row.content {
        case let .prompt(text): FeedPrompt(text: text, isExpanded: $isExpanded)
        case let .message(markdown): FeedProse(text: markdown, voice: .message)
        case let .thought(markdown): FeedProse(text: markdown, voice: .thought)
        case let .call(call):
            FeedCallLine(call: call, isOpen: isOpen, open: openEvidence)
        case let .survey(survey):
            FeedSurveyLine(survey: survey, isOpen: isOpen, open: openEvidence)
        // A gallery opens no panel — what a shot produced IS the shot, so the click goes straight
        // to the picture.
        case let .gallery(gallery):
            FeedGalleryRow(gallery: gallery, open: selection.light)
        case let .ask(ask): FeedAskLine(ask: ask)
        case let .mark(mark): FeedMarkLine(mark: mark)
        case let .unreadable(unreadable):
            FeedUnreadableLine(unreadable: unreadable, isExpanded: $isExpanded)
        }
    }

    private var isOpen: Bool {
        selection.open == row.id
    }

    /// What Return does to this row, which is exactly what a click on it does.
    ///
    /// A gallery opens the FIRST picture there is anything behind. Its shots are each a control of
    /// their own, so a reader who wants the fourth reaches it the same way they reach any button;
    /// what the row-level key gets them is the common case in one press.
    ///
    /// A row with nothing to open answers `.ignored` rather than `.handled` — prose, a gallery of
    /// absences, and a call the record never answered alike. Swallowing the key on an inert row
    /// spends it on nothing AND takes it away from the feed, which is where scrolling lives.
    private func activate() -> KeyPress.Result {
        switch row.content {
        case .call, .survey:
            guard isOpen || row.opensEvidence else { return .ignored }
            openEvidence()
            return .handled
        case let .gallery(gallery):
            guard let shot = gallery.shots.first(where: \.isOpenable) else { return .ignored }
            selection.light(shot)
            return .handled
        case .prompt, .unreadable:
            isExpanded.toggle()
            return .handled
        // A question and a mark open nothing — one is somebody being waited on, the other is the
        // shape of the record — so the key falls through to the feed, where scrolling lives.
        case .message, .thought, .ask, .mark:
            return .ignored
        }
    }

    /// A second press on the open row closes it. The row is the control, so it is also the way back
    /// out — a panel whose only exit is its own ✕ makes the reader aim at the far side of the deck
    /// to undo an action they took on this one.
    ///
    /// A row with nothing behind it opens nothing at all, rather than marking itself as the open
    /// row over a panel that has nothing to show.
    private func openEvidence() {
        guard !isOpen else { return selection.close() }
        guard row.opensEvidence else { return }
        selection.openEvidence(of: row.id)
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
