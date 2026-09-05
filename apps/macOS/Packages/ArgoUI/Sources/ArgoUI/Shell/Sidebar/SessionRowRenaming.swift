import SwiftUI

/// Renaming one roster row: the write, and whether its field is open.
///
/// One value because neither half is the row's own — the menu bar's Rename opens the field from
/// outside the sidebar entirely — and a row handed one without the other could only ever draw
/// half the gesture.
package struct SessionRowRenaming {
    var rename: (String?) -> Void = { _ in }
    var isOpen: Binding<Bool> = .constant(false)

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(rename: @escaping (String?) -> Void = { _ in }, isOpen: Binding<Bool>) {
        self.rename = rename
        self.isOpen = isOpen
    }

    /// The inert one, which is what every specimen and preview of a row draws.
    package init() {}
}
