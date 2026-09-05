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

/// What the row's Archive item acts on (#1247), and the write it performs.
package struct SessionRowArchiving {
    /// The Sessions the pointer's row stands for: the whole selection when the row is in it, and
    /// that row alone when it is not. In the roster's own order, and all on the SAME side of the
    /// foot as the row under the pointer — a menu that says "Archive 4 Sessions" archives four.
    var targets: [String] = []
    /// Clear them off the roster, or put them back.
    var act: ([String], Bool) -> Void = { _, _ in }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(targets: [String] = [], act: @escaping ([String], Bool) -> Void = { _, _ in }) {
        self.targets = targets
        self.act = act
    }
}
