/// The two inks a pull request is read in. Its own file for the reason `DiffRoles` has one: a
/// group carrying a rule of its own outgrows the sheet that merely lists the groups.
public extension ArgoPalette {
    /// What the code host is holding, as a pair of inks. **These are the code host's own
    /// colours, not this contract's inventions**: a reader arrives already knowing that a merged
    /// pull request is purple, and the domain says a code-host fact keeps the host's vocabulary.
    ///
    /// The family is two roles wide and stays that way. A CLOSED pull request takes
    /// `state.failure` and a DRAFT takes `state.idle` — both sit within a few points of roles
    /// that already exist, and two reds on one roster row is the same error as two greens.
    ///
    /// `open` sits one hue from `state.running`, and on a running row the Turn clock spends the
    /// running ink as well. That was put to the person who owns the design and answered: the
    /// host's colours stand, and the row separates them by shape. It is not an exemption — the
    /// pair clears every distance the contract holds, and `VisualContractTests` measures them.
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
