/// Whether the Connect panel is up, what it is showing, and what it can do.
///
/// One value rather than three parameters on the shell, because the three are only ever true
/// together: a reading with nothing to act on is a panel nobody can finish, and actions with no
/// reading are a panel that is not there.
public struct ConnectSurface {
    /// `nil` is the panel closed. It is the reading's absence rather than a flag beside it, so
    /// "open" and "has something to draw" cannot disagree.
    public let reading: ConnectReading?
    /// Only a machine that has never set a Project up sees Welcome, and only once.
    public let startsAtWelcome: Bool
    public let actions: ConnectPanelActions

    @MainActor public static let closed = ConnectSurface(
        reading: nil,
        startsAtWelcome: false,
        actions: .inert,
    )

    public init(
        reading: ConnectReading?,
        startsAtWelcome: Bool = false,
        actions: ConnectPanelActions,
    ) {
        self.reading = reading
        self.startsAtWelcome = startsAtWelcome
        self.actions = actions
    }
}
