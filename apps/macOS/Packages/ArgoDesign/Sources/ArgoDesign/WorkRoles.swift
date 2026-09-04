/// The three families that say what the WORK amounts to, held together rather than spread across
/// the palette's parameter list — the reason `AtlasRoles` is one value (#1142), applied to the
/// other side of the roster row (#1341).
public extension ArgoPalette {
    /// What came out of a run, and how far it got. `StateRoles` answers what a Session is DOING;
    /// none of these does, and that is the line the group is drawn on.
    ///
    /// The name is deliberately not a domain entity: it holds the ink for a **Delivery** and the
    /// ink for a **Plan**, so naming it after either would claim one contains the other.
    ///
    /// The palette forwards all three by name — `palette.diff`, `palette.delivery`,
    /// `palette.progress` — so this type is the shape of the init and never a second role path.
    struct WorkRoles: Sendable {
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
