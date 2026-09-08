/// One row's name as the cockpit DRAWS it, and where those words came from (#1623).
///
/// The words rather than the standing they were won at: `SessionTitle` decides which of a Session's
/// names a row wears, and by the time the mirror runs that contest is over. What it still has to
/// know is where they CAME from — a name Argo derived is the one case that has to clear a floor
/// before it may be typed at all.
///
/// It no longer asks whether the READER chose them (#1653). That fact existed to except a person's
/// rename from a gate that yielded to any CLI title, and with the gate gone there is nothing for
/// the exception to except: the roster's words are typed whoever wrote them.
public struct SessionNameDraw: Sendable, Equatable, Hashable {
    /// The name on the row, spelled exactly as the roster spells it — Argo's own edits included,
    /// which is deliberate: the two surfaces agreeing is the whole point, and a phone showing the
    /// unedited words would disagree with the desk again (`ArgoUI.SessionTitle.spelled`).
    public let name: String
    /// Whether the row fell all the way through the naming chain to its OWN summary — so these
    /// words are Argo's reading of the conversation rather than a Ticket's or a person's
    /// (`ArgoUI.SessionTitle.Naming.drawsDerivedTitle`). Only these are held to the floor:
    /// a Ticket's sentence says what the work is whatever the transcript has managed to say.
    public let drawsDerivedTitle: Bool
    /// Whether a slash command typed at this Session would be RUN right now. Not a gate — the
    /// driver refuses a held keyboard itself — but the fact whose CHANGE brings the sweep back,
    /// which is how a refused `/rename` is retried rather than lost.
    ///
    /// It has to be the reading the DRIVER refuses on (`SessionStatus.takesSlashCommand`) and not
    /// the wider one about a prompt: a map keyed on a fact that stands still across
    /// `.permission -> .running` sleeps through the one transition that frees a blocked rename
    /// (#1662).
    public let takesSlashCommand: Bool
    /// The title the ROSTER held when this draw was taken (`HubSession.title`) — which roster pass
    /// the name above came from, said in the only words both readings share (#1695).
    ///
    /// Not the name: `name` is the cockpit's spelling of the chain's answer, which can be a
    /// Ticket's sentence, a clock-prefixed summary or a person's rename. This is the row's own
    /// title underneath all of it, and the standing the floor reads is the standing OF it.
    public let rosterTitle: String

    public init(
        name: String,
        drawsDerivedTitle: Bool,
        takesSlashCommand: Bool,
        rosterTitle: String,
    ) {
        self.name = name
        self.drawsDerivedTitle = drawsDerivedTitle
        self.takesSlashCommand = takesSlashCommand
        self.rosterTitle = rosterTitle
    }
}
