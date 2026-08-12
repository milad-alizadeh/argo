import Foundation

// A feed row read as the shape the lane draws it with (#382). The one place the miniature's
// vocabulary meets the feed's, and the reason the lane reads as the reading shrunk rather than as a
// legend beside it: every alignment here is the row's own, and every ink is the row's own.
//
// Nothing here builds a run or measures a string. It runs over every row of the reading each time
// the feed reshapes, so a prose row's markdown structure comes off `ProseReading`'s cache — one
// parse per distinct text, a lookup after.

extension MinimapRow {
    /// One feed row as the lane draws it, at the height the table measured for it.
    @MainActor init(_ row: FeedRow, height: CGFloat) {
        self.init(height: height, shape: row.content.shape)
        if case let .prompt(text) = row.content {
            prompt = text
        }
        endsTurn = row.content.endsTurn
    }
}

private extension FeedRow.Content {
    @MainActor var shape: MinimapRowShape {
        switch self {
        // The prompt's lines, held against the trailing edge its bubble is drawn on.
        case let .prompt(text): .bubble(length: text.utf8.count)
        case let .message(text): MinimapProseBlock.shape(of: text, ink: .message)
        case let .thought(text): MinimapProseBlock.shape(of: text, ink: .thought)
        case let .call(call): call.shape
        case let .survey(survey): .sentence(length: survey.length, ink: survey.ending.ink)
        case let .unreadable(unreadable):
            .sentence(length: unreadable.label.utf8.count, ink: .unreadable)
        // Rows the lane draws as a shape rather than as a length. None is a sentence running out
        // across the column, so none takes a sentence's width.
        //
        // Each asks its own type for its ink rather than answering for it here: a question that has
        // been answered goes quiet in the row, and the lane has to go quiet with it.
        case let .gallery(gallery): .shots(count: gallery.shots.count)
        case let .ask(ask): .whole(ask.ink)
        case let .mark(mark): .whole(mark.ink)
        }
    }

    /// Whether a Turn ends at this row. The feed's own punctuation and nothing else: the stop
    /// reason the host reported, and the interruption that stands in for one.
    ///
    /// Switched with no `default`, so a mark added to the feed has to say whether it closes a Turn
    /// rather than inheriting an answer written for the ones that exist today.
    var endsTurn: Bool {
        guard case let .mark(mark) = self else { return false }
        switch mark {
        case .turnEnded, .interrupted: return true
        case .compacted, .spent, .handedOff, .permissionExpired, .working: return false
        }
    }
}

private extension FeedCall {
    /// A call as the lane draws it: one slab for the sentence, and the mutation's two halves at the
    /// end of it where the record carried a patch to count — which is exactly where the row itself
    /// draws `+n −n`.
    var shape: MinimapRowShape {
        // A failure is drawn as the failure it was, not as the mutation it attempted — the feed
        // puts the whole line in the failure ink, and the counts beside a red line would read as
        // a change that landed.
        guard let churn, !churn.isSilent, !ending.hasFailed else {
            return .sentence(length: length, ink: ending.ink)
        }
        return .change(length: length, added: churn.added, removed: churn.removed)
    }
}
