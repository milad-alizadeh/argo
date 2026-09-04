/// One archive waiting to be confirmed — the Session it would end, held while the prompt is up
/// (#1290).
///
/// Both halves are captured when the gesture is made rather than read back when the button is
/// pressed. The Session is mid-turn, so its row is moving: a title read a second time could have
/// changed under the prompt, and an id resolved a second time could belong to whatever the roster
/// has since selected. What the reader was asked about is what gets archived.
///
/// `Identifiable` on the id, so the two gestures raising it in turn redraw one prompt rather than
/// stacking two.
struct ArchiveConfirmation: Identifiable, Equatable {
    let id: String
    /// The Session's name as the roster is drawing it, for the prompt's own title.
    let name: String
}
