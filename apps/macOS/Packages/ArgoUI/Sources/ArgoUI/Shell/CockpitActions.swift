public struct CockpitActions {
    public let refreshCheckout: () -> Void
    public let retryConnection: () -> Void

    public init(refreshCheckout: @escaping () -> Void, retryConnection: @escaping () -> Void) {
        self.refreshCheckout = refreshCheckout
        self.retryConnection = retryConnection
    }
}
