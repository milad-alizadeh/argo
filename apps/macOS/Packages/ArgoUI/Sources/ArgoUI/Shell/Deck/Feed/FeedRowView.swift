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
    /// A gallery opens the first picture there is anything behind — the row is one control in the
    /// keyboard's eye, and a reader who wants the fourth shot arrows into the gallery and picks it.
    /// Prose does nothing and says so by being handled: `.ignored` lets the key fall through to the
    /// feed, which is where scrolling lives.
    private func activate() -> KeyPress.Result {
        switch row.content {
        case .call, .survey:
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
        guard isOpen else {
            if row.opensEvidence {
                selection.openEvidence(of: row.id)
            }
            return
        }
        selection.close()
    }
}
