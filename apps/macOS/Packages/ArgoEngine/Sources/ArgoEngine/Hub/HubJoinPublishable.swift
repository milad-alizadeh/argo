/// Which of the join's transcripts the roster may be folded from while the rest are still being
/// read.
///
/// The roster used to publish NOTHING until every admitted transcript had settled. At three
/// transcripts nobody noticed; at a week's working set one slow or unreadable file is the whole
/// launch, so the fold is taken over what has settled instead — briefly missing a row, which is the
/// degrade the reader can live with.
///
/// What they cannot live with is a row published and then taken away. A resume file names the
/// transcript it continues, and publishing it as a Session of its own before that parent is read
/// lets the parent's arrival ABSORB it: one row vanishes and another changes under the cursor. So a
/// settled transcript is held back where the link it declares points at something unresolved — a
/// handful of resume files for the length of one read, never the whole set.
struct HubJoinPublishable {
    /// The transcripts to fold, in the join's own order — which is what keeps the rows already on
    /// screen in the order they are already in.
    let transcripts: [HubTranscript]
    /// Whether that is the whole set. Only then may a later batch be written into the roster in
    /// place: a fold over part of the set cannot say where the rest of it belongs
    /// (`HubRoster.holdWrites`).
    let isComplete: Bool

    init(of transcripts: [HubTranscript], owners: [String: String]) {
        let unsettled = Set(transcripts.lazy.filter { !$0.isSettled }.map(\.sessionID))
        guard !unsettled.isEmpty else {
            self.transcripts = transcripts
            self.isComplete = true
            return
        }
        let settled = Set(transcripts.lazy.filter(\.isSettled).map(\.id))
        // A leaf no SETTLED transcript owns may still be claimed by one that has not been read, and
        // an origin naming an unread file is the same ambiguity — both resolve down to waiting.
        let published = transcripts.filter { transcript in
            guard transcript.isSettled else { return false }
            if let leaf = transcript.session.headLeafUUID {
                guard let owner = owners[leaf], settled.contains(owner) else { return false }
            }
            guard let origin = transcript.session.originSessionID,
                  origin != transcript.sessionID
            else { return true }
            return !unsettled.contains(origin)
        }
        self.transcripts = published
        self.isComplete = published.count == transcripts.count
    }
}
