/// What a Session is STARTED at — the CLI's own two knobs together, Model and Effort (#558, #1175).
///
/// One value rather than two arguments everywhere they travel: they are picked in the same popover,
/// remembered in the same file, and put on the same argv, and a spawn that carried one without the
/// other would open a Session Argo could state only half of.
///
/// The model is the CLI's own word for it and is never normalised (#558's rule): an alias like
/// `opus` is what `--model` takes, so a Session opened today lands on the latest of that family.
public struct SessionRun: Equatable, Sendable {
    /// What is TYPED after `--model`. An alias for the three the composer offers, and a full id for
    /// a value that came back off a record.
    public let model: String
    public let effort: SessionEffort

    public init(model: String, effort: SessionEffort) {
        self.model = model
        self.effort = effort
    }

    /// Where a New Session opens with nothing ever picked: `Opus 5 · Medium`, which is the pair the
    /// composer's reset already names as its target (#1175).
    ///
    /// The alias and not the dated id, for the reason `model` gives — and the same alias the
    /// composer's own first row offers, which `RunFactsTests` holds the two to.
    public static let unpicked = SessionRun(model: "opus", effort: .medium)
}

/// One of the two knobs, picked on its own (#1175). The popover sets one at a time, and a pick is
/// remembered where it LANDED — so what travels from the driver to the store is the half that
/// moved, never a whole pair half of which nobody chose.
public enum SessionRunPick: Equatable, Sendable {
    case model(String)
    case effort(SessionEffort)
}
