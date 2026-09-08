/// Where one Session's name stands on both sides of the ladder, read off the Hub (#1623).
///
/// Two facts about the name, because the mirror asks two different questions: whether Claude
/// already has a name for this Session, and whether the name ARGO holds is one worth putting at a
/// prompt. The third is about neither: which roster pass those two were read in.
public struct SessionNameStanding: Sendable, Equatable {
    /// The CLI's own title, and `nil` where it holds none — see `SessionTitle.cliTitle`.
    public let cliTitle: String?
    /// Whether the name Argo derived says anything about the work — see
    /// `SessionTitle.namesTheWork`.
    public let namesTheWork: Bool
    /// The title the roster held when the two facts above were read (`HubSession.title`) — the
    /// other half of `SessionNameDraw.rosterTitle`, and the whole of the mirror's same-pass check
    /// (#1695).
    public let rosterTitle: String

    public init(cliTitle: String?, namesTheWork: Bool, rosterTitle: String) {
        self.cliTitle = cliTitle
        self.namesTheWork = namesTheWork
        self.rosterTitle = rosterTitle
    }
}
