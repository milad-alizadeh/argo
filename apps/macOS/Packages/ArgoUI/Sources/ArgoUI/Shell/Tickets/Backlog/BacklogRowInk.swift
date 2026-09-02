/// What one backlog row is drawn in, given the ground under it — the room's one selection that is
/// read on the LOUD rung of the brand hue rather than on the quiet one every sidebar row takes
/// (#1071, amending D30).
///
/// A value rather than three call-site conditionals, because the contract asserts these readings
/// absolutely — `LoudSelectionGroundTests`.
struct BacklogRowInk: Equatable {
    /// The ground the row lays for ITSELF. Argo's own for the roster's reason (D30, 2026-08-31):
    /// the platform's fill is the loud accent only while the list is first responder and a mid
    /// grey the rest of the time, and no one ink clears the floor on both.
    let ground: ArgoColor
    let title: ArgoColor
    /// The `#id`.
    let machine: ArgoColor
    let caption: ArgoColor
    /// The opaque ground anything carrying its own — a label chip, the blockage mark — must be
    /// laid over to keep the reading it was measured for, and `nil` where the deck's own surface
    /// is already under it.
    let backdrop: ArgoColor?

    init(isSelected: Bool, isRail: Bool, palette: ArgoPalette) {
        guard isSelected else {
            self.ground = .transparent
            // A rail is on screen for a descendant's sake rather than for its own match, so its
            // title takes the demotion the `#id` beside it already carries (#873).
            self.title = isRail ? palette.text.tertiary : palette.text.secondary
            self.machine = palette.text.tertiary
            self.caption = palette.text.disabled
            self.backdrop = nil
            return
        }
        self.ground = palette.interaction.accent
        // One ink for all three voices: the band that clears the floor on this ground ends near
        // `#323232`, so there is no room in it for three loudnesses and the row keeps its
        // hierarchy in face and size. The rail's demotion goes with them for the same reason.
        self.title = palette.text.onAccent
        self.machine = palette.text.onAccent
        self.caption = palette.text.onAccent
        self.backdrop = palette.surface.base
    }
}
