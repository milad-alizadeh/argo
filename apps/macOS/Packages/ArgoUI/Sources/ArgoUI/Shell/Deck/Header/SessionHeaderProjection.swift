/// What the deck's header zone says about the Session it is showing — the roster projection's
/// counterpart above the feed, at the same altitude and in the same shape.
///
/// Every honesty rule the header carries lives HERE rather than in the view that draws it: which
/// facts a posture is allowed to claim, and which word each of them spends. A view can be looked
/// at, but it cannot be asserted, and a rule that only exists inside a `body` is a rule nothing
/// can hold to. The zones the later header tickets fill — the branch and its state, the CLI and
/// model, the linked issue, the context reading — land on `Header` for the same reason.
enum SessionHeaderProjection {
    struct Header: Equatable, Sendable {
        /// The Session's own title, verbatim. Never shortened, completed or re-capitalised: the
        /// header names its subject rather than describing it.
        let title: String
        /// The one word a Session spends when it is not a plain managed one, and `nil` when it
        /// is — the default state is silent, and a mark drawn on every header is a mark that has
        /// stopped meaning anything by the second Session.
        let accessWord: String?
        /// What that word MEANS, in a sentence, for the surface that can afford one. Absent
        /// exactly when the word is, so the two can never disagree about whether there is
        /// anything to say.
        let accessDetail: String?

        /// `fileprivate`, so `header(from:)` is the only way a header comes into being and no
        /// surface can assemble one that disagrees with what the projection decided.
        fileprivate init(title: String, accessWord: String?, accessDetail: String?) {
            self.title = title
            self.accessWord = accessWord
            self.accessDetail = accessDetail
        }

        /// What a screen reader hears: the same word the header draws, because a mark is ink and
        /// ink is nothing a screen reader can hear.
        var announcement: String {
            [title, accessWord].compactMap(\.self).joined(separator: ", ")
        }
    }

    static func header(from session: CockpitPresentation.Session) -> Header {
        let mark = mark(for: session.access)
        return Header(title: session.title, accessWord: mark?.word, accessDetail: mark?.detail)
    }

    /// Access → the mark the header spends on it, if any.
    ///
    /// Three answers and not two, because `external` and `orphaned` are one axis and two facts:
    /// both are Sessions nobody here can drive, and only one of them was ever Argo's. A header
    /// that spelled them alike would tell somebody their own Session had never been theirs.
    private static func mark(
        for access: CockpitPresentation.Session.Access,
    )
        -> (word: String, detail: String)? {
        switch access {
        case .managed:
            nil
        case .external:
            (
                "Read-only",
                "Argo never owned this Session's terminal, so it cannot be driven from here.",
            )
        case .orphaned:
            (
                "Orphaned",
                "Argo owned this Session; its terminal died with the process, "
                    + "so it cannot be driven from here.",
            )
        }
    }
}
