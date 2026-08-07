/// What the Hub can say about the Project it is pointed at.
///
/// `idle` is not a lesser `connected`: a Project whose working set is empty has no source to be
/// connected TO, and rendering it as connected would claim one that does not exist.
public enum HubConnection: Equatable, Sendable {
    /// At least one transcript is being read right now.
    case connected

    /// Being pointed: the previous Project is torn down and the new one has established nothing
    /// yet. `connect` suspends twice in that window, so a view does render inside it — and `idle`
    /// there would say the Project being switched to has nothing on it, a beat before it does.
    case connecting

    /// Pointed at a Project and reading nothing — nothing in its working set, or every tail it had
    /// has stopped. Not a failure, and not a connection either.
    case idle

    case failed(message: String)
}
