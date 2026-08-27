/// The three things a scope picker can do, already bound to the port it is open on.
///
/// The row narrows `ConnectPanelActions` down to this before handing it over, so the picker never
/// holds a port or an Account id it could pass the wrong one of.
struct ConnectScopePickerActions {
    let bind: (String) -> Void
    let retry: () -> Void
    let cancel: () -> Void
}
