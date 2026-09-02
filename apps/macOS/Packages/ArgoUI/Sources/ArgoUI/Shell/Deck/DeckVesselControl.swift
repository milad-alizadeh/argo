/// The deck's one slot below the reading, as a control: what is in it, and what its controls do.
/// The two are one thing to hand over — a vessel drawn without its intents is a control that does
/// nothing when pressed.
@MainActor struct DeckVesselControl {
    /// See `DeckVessel`. The undriveable line is not part of this: it replaces the reading's end
    /// rather than floating over it, so `SessionsDeck` owns it.
    var vessel = DeckVessel.none
    var intents = DeckIntents.inert

    /// An empty slot nothing is wired to — what `DeckContentRow` draws when nobody names one.
    static let inert = DeckVesselControl()
}
