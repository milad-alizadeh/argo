/// Why no built-in commands were read (#686). Both cases mean the same thing to the picker: the
/// CLI's half of the catalog is unavailable.
enum HelpPanelError: Error, Equatable {
    /// The panel stopped mid-list, so the rows below the last drawn one were never on screen.
    case truncated
    /// No command list was on the screen at all.
    case noCommandList
}
