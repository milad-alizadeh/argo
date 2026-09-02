/// The two inks a change is read in. Its own file for the reason `TextRoles` has one: a group
/// carrying a rule of its own outgrows the sheet that merely lists the groups.
public extension ArgoPalette {
    /// What a change did to a file, as a pair of inks. The contract asserts their distance from
    /// `state`, which they share a feed with inches apart.
    struct DiffRoles: Sendable {
        public let added: ArgoColor
        public let removed: ArgoColor

        public init(added: ArgoColor, removed: ArgoColor) {
            self.added = added
            self.removed = removed
        }

        public var all: [(name: String, color: ArgoColor)] {
            [("added", added), ("removed", removed)]
        }

        /// The same role as a GROUND under a whole line of code rather than as an ink on it.
        /// Weaker than `StateRoles.muted`: source has to stay readable on it.
        public func wash(_ role: ArgoColor) -> ArgoColor {
            role.opacity(0.12)
        }
    }
}
