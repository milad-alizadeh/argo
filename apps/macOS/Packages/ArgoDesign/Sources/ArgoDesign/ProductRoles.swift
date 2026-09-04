/// The three families that say what the WORK amounts to, held together rather than spread across
/// the palette's parameter list — the reason `AtlasRoles` is one value (#1142), applied to the
/// other side of the roster row (#1341).
public extension ArgoPalette {
    /// What came out of a run, and how far it got. `StateRoles` answers what a Session is DOING;
    /// none of these does, and that is the line this group is drawn on: a diffstat, a pull request
    /// and a Plan's progress are all read on one roster row inches from a state dot, and each is
    /// held clear of every state by the contract's own distance.
    ///
    /// The palette forwards all three by name — `palette.diff`, `palette.delivery`,
    /// `palette.progress` — so this type is the shape of the init and never a second spelling of a
    /// role path.
    struct ProductRoles: Sendable {
        /// What a change did to a file.
        public let diff: DiffRoles
        /// What the code host is holding.
        public let delivery: DeliveryRoles
        /// How far a Plan got.
        public let progress: ProgressRoles

        public init(diff: DiffRoles, delivery: DeliveryRoles, progress: ProgressRoles) {
            self.diff = diff
            self.delivery = delivery
            self.progress = progress
        }
    }
}
