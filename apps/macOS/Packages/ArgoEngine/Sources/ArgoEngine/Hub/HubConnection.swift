public enum HubConnection: Equatable, Sendable {
    case healthy
    case reconnecting
    case failed(message: String)
}
