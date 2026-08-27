/// What a scope picker can do, already bound to the port it is open on and the Account it is
/// choosing for, so it can never pass the wrong one of either.
struct ConnectScopePickerActions {
    let bind: (String) -> Void
    /// Ask the provider again with the same grant. For a read that failed, never for one refused.
    let retry: () -> Void
    /// Authorize again. The repair for a refused grant, which no retry can fix.
    let reconnect: () -> Void
    let cancel: () -> Void
}
