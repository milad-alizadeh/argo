/// The two inks a pull request is read in. Its own file for the reason `DiffRoles` has one: a
/// group carrying a rule of its own outgrows the sheet that merely lists the groups.
public extension ArgoPalette {
    /// What the code host is holding, as a pair of inks. **The host's own colours, not this
    /// contract's inventions**: a code-host fact keeps the host's vocabulary.
    ///
    /// Two roles wide, and it stays that way: a CLOSED pull request takes `state.failure` and a
    /// DRAFT takes `state.idle` (#1341).
    ///
    /// `open` is 0.361 from `state.running`, the pair's nearest miss, and a running row spends
    /// that ink on its own dot inches away. It clears the 0.25 every hue here is held to, and
    /// `VisualContractTests` measures it rather than waiving it.
    struct DeliveryRoles: Sendable {
        /// A pull request the code host holds open.
        public let open: ArgoColor
        /// One it merged.
        public let merged: ArgoColor

        public init(open: ArgoColor, merged: ArgoColor) {
            self.open = open
            self.merged = merged
        }

        public var all: [(name: String, color: ArgoColor)] {
            [("open", open), ("merged", merged)]
        }
    }
}
