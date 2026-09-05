/// What the roster row's Archive item acts on (#1247), and the write it performs.
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
