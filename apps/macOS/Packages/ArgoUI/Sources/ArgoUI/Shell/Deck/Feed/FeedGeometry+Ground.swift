import Foundation

// What one row's height is a fact ABOUT — the key `FeedGeometry` files every height under, kept in
// a file of its own because it is the whole of that store's correctness.

extension FeedGeometry {
    /// What one row's height is true of, beyond the pass it was measured in.
    ///
    /// The row's CONTENT and never its `id`, which is its index. The id says where the row sat, and
    /// a row that moved because a bounded excerpt grew into the whole file is the same row at the
    /// same height (`TranscriptExcerpt`).
    ///
    /// Everything a height can turn on is in here, and two grounds that compare equal are two rows
    /// that draw the same. The row itself, because its words are what wrapped. The row above it,
    /// because `FeedRow.step(to:from:)` puts the gap above a row INSIDE that row's height. Whether
    /// it is unfolded, because a folded prompt is three lines and an unfolded one is the whole of
    /// it. Whether it is the open row, because a survey draws a line per call when it is
    /// (`FeedSurveyLine`) and nothing when it is not. And whether it draws its Turn's copy chip —
    /// the one fact here that is about neither the row nor the row above: two rows saying the same
    /// words under the same row stand at different heights when one of them is the last message of
    /// its Turn and the other is not (`FeedCopy.drawsChip(of:at:)`).
    ///
    /// A key rather than a guard on a key, so two rows that draw differently CANNOT share an entry:
    /// `hash(into:)` only chooses the bucket, and `==` over every fact above is what answers.
    struct Ground: Hashable {
        let row: FeedRow.Content
        let above: FeedRow.Content?
        let isUnfolded: Bool
        let isOpen: Bool
        let drawsChip: Bool

        /// Built from the model the row is drawn out of, so the list above cannot drift from what
        /// `FeedTableModel.content(at:)` actually reads.
        @MainActor init(at index: Int, of model: FeedTableModel) {
            let row = model.rows[index]
            self.row = row.content
            self.above = index > 0 ? model.rows[index - 1].content : nil
            self.isUnfolded = model.unfolded.wrappedValue.contains(row.id)
            self.isOpen = model.selection.open == row.id
            self.drawsChip = FeedCopy.drawsChip(of: model.rows, at: index)
        }

        func hash(into hasher: inout Hasher) {
            hasher.combine(isUnfolded)
            hasher.combine(isOpen)
            hasher.combine(drawsChip)
            row.spread(into: &hasher)
            above?.spread(into: &hasher)
        }
    }
}

extension FeedRow.Content {
    /// What a ground's hash spreads on — a BUCKET and never an answer, so a coarse spread costs a
    /// comparison and can never cost a wrong height.
    ///
    /// Cheap on purpose, because a ground is hashed for every row of every whole-document walk.
    /// Hashing the content whole would walk every byte of a message and every byte of the evidence
    /// behind a call, where `==` between two rows out of one projection stops at the first byte
    /// that differs — and stops at once where the two share their storage.
    ///
    /// The three crowded kinds get their words' length and both ends, which tells a run of
    /// near-identical lines apart in constant time. A call gets what its sentence NAMES. Every
    /// other kind is a handful of rows in a reading, so its shape and a count spread it enough.
    func spread(into hasher: inout Hasher) {
        hasher.combine(shape)
        switch self {
        case let .prompt(text, shots):
            hasher.combine(shots.count)
            Self.spread(text, into: &hasher)
        case let .message(text), let .thought(text):
            Self.spread(text, into: &hasher)
        case let .call(call):
            hasher.combine(call.repeats)
            Self.spread(call.subject.captioned, into: &hasher)
        case let .survey(survey): hasher.combine(survey.calls.count)
        case let .gallery(gallery): hasher.combine(gallery.shots.count)
        case let .ask(ask): hasher.combine(ask.isAnswered)
        case let .skillLoaded(skill): Self.spread(skill.address, into: &hasher)
        case let .mark(mark): hasher.combine(mark.ink)
        case let .unreadable(unreadable): hasher.combine(unreadable.count)
        }
    }

    /// The length and both ends of a string, which is as much of it as a bucket needs. Constant
    /// time: a `String`'s UTF-8 count is O(1), and so is a bounded walk in from either end.
    private static func spread(_ text: String, into hasher: inout Hasher) {
        let bytes = text.utf8
        hasher.combine(bytes.count)
        for byte in bytes.prefix(Self.spreadBytes) {
            hasher.combine(byte)
        }
        for byte in bytes.suffix(Self.spreadBytes) {
            hasher.combine(byte)
        }
    }

    /// How much of either end a string is spread by. Eight, because the rows a real reading crowds
    /// a bucket with are lines of one length differing near an end — a numbered line, a repeated
    /// sentence — and eight bytes is past the digits.
    private static let spreadBytes = 8
}
