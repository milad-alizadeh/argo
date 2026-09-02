@testable import ArgoUI
import Testing

/// The third ground the contract names: the FULL-STRENGTH accent under a selected backlog row
/// (#1071). `SelectionGroundTests` is its peer and holds the other two — `surface.base` and the
/// quiet `interaction.selectionGround` — and this suite exists because the backlog's row is read
/// on neither.
///
/// Its own suite for the reason that one has its own: these are claims about one decision, and the
/// decision here reverses #922's refusal of a ground-dependent ramp for exactly one ground.
@Suite("Loud selection ground")
struct LoudSelectionGroundTests {
    static let palettes = ArgoPalette.all
    static let floor = ArgoPalette.TextRoles.contrastFloor
    /// What the platform fills a selected row with while its list is NOT first responder —
    /// `NSColor.unemphasizedSelectedContentBackgroundColor` in the dark appearance, the value #922
    /// measured off a render. A literal because no role names it: it is the platform's ground, not
    /// Argo's, and the point of the claim below is that the app may not be read on it.
    static let platformUnemphasised = ArgoColor(hex: 0x464646)

    /// The decision: the loud rung stays under the row the reader is working in, and the ink lifts
    /// off the neutral ramp instead. Argo lays that ground itself for the roster's own reason
    /// (D30, 2026-08-31) — the platform's fill is the loud accent only while the list is first
    /// responder, and a ground that changes with focus cannot carry an absolute reading.
    @Test(arguments: palettes)
    func `a selected backlog row's ground is the loud rung, laid by Argo`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let ink = BacklogRowInk(isSelected: true, isRail: false, palette: appearance.palette)
        #expect(ink.ground == appearance.palette.interaction.accent)
        // Opaque for #922's reason: the platform draws its own fill under this one, and a
        // translucent ground composites onto it rather than replacing it.
        #expect(ink.ground.opacity == 1)
    }

    /// The ticket's own criterion, absolute and not relative: every voice a selected backlog row
    /// is set in clears the ramp's floor on the ground the row draws. The caption is in this loop
    /// where `SelectionGroundTests` exempts `text.disabled` — on the loud ground it is not an
    /// absence but one of three voices, and `4d` was as unreadable as the words.
    @Test(arguments: palettes)
    func `every voice a selected backlog row is set in clears the floor on the loud ground`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let ink = BacklogRowInk(isSelected: true, isRail: false, palette: appearance.palette)
        for voice in [ink.title, ink.machine, ink.caption] {
            #expect(voice.contrastRatio(on: ink.ground) >= Self.floor)
        }
    }

    /// Why the ground is Argo's rather than the platform's, as arithmetic. The platform offers two
    /// fills for one state — the loud accent while its list is first responder, a mid grey while
    /// it is not — and their luminances are five times apart. A floor of 4.5:1 on the light one
    /// forces a near-black ink and on the dark one forces a near-white, so NO ink clears the floor
    /// on both. #922 was a ramp chosen against one ground and read on another; a ramp chosen
    /// against a ground that changes under it would be the same failure with no value to fix it.
    @Test(arguments: palettes)
    func `no one ink could clear the floor on both fills the platform draws`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let loud = appearance.palette.interaction.accent
        let candidates = (0 ... 255).map { ArgoColor(hex: UInt32($0) * 0x010101) }
            + appearance.palette.text.all.map(\.color)
        for ink in candidates {
            #expect(
                ink.contrastRatio(on: loud) < Self.floor
                    || ink.contrastRatio(on: Self.platformUnemphasised) < Self.floor,
            )
        }
    }

    /// One ink for all three voices, and that is the whole of the reversal. The band that clears
    /// the floor on the loud ground ends near `#323232` — every value in it reads as one
    /// near-black at a glance — so there is no room in it for three loudnesses. The row keeps its
    /// hierarchy in face and size, which is where a filled control has always kept it.
    @Test(arguments: palettes)
    func `the loud ground carries one ink, because the band above the floor holds one`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let ink = BacklogRowInk(isSelected: true, isRail: false, palette: palette)
        #expect(ink.title == palette.text.onAccent)
        #expect(ink.machine == ink.title)
        #expect(ink.caption == ink.title)
        // A rail is on screen for a descendant's sake, and that demotion is a rung of the neutral
        // ramp: on the loud ground there is no quieter rung to demote to.
        let rail = BacklogRowInk(isSelected: true, isRail: true, palette: palette)
        #expect(rail.title == ink.title)
    }

    /// A mark carrying its own ground keeps its own reading, PROVIDED that ground is opaque — the
    /// chips wash the provider's hue at `labelGroundWash` and the blockage mark strokes a capsule
    /// over nothing at all, and both were measured against the deck. So the row hands them the
    /// deck's own surface to be laid over, and every hue on them is read where it was chosen.
    @Test(arguments: palettes)
    func `a mark carrying its own ground is laid on the deck's, not on the loud one`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let selected = BacklogRowInk(isSelected: true, isRail: false, palette: palette)
        #expect(selected.backdrop == palette.surface.base)
        // The mark's two inks are the Route's, and this is what carries them across: they clear
        // the floor on the deck, and on the loud ground they read at 1.2:1.
        for state in [palette.state.idle, palette.state.failure] {
            #expect(state.contrastRatio(on: palette.surface.base) >= Self.floor)
            #expect(state.contrastRatio(on: palette.interaction.accent) < Self.floor)
        }
        // Nothing to lay on an unselected row: the deck's own surface is already under it.
        #expect(BacklogRowInk(isSelected: false, isRail: false, palette: palette).backdrop == nil)
    }

    /// And the unselected row is untouched — it draws no ground of its own and keeps the neutral
    /// ramp. `caption` is `text.disabled` there and stays exempt from the floor: on the deck it is
    /// an absence rather than a voice, which is the reading `SelectionGroundTests` already holds.
    @Test(arguments: palettes)
    func `an unselected backlog row keeps the neutral ramp and lays no ground`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let ink = BacklogRowInk(isSelected: false, isRail: false, palette: palette)
        #expect(ink.ground == .transparent)
        #expect(ink.title == palette.text.secondary)
        #expect(ink.machine == palette.text.tertiary)
        #expect(ink.caption == palette.text.disabled)
        #expect(BacklogRowInk(isSelected: false, isRail: true, palette: palette).title == palette
            .text.tertiary)
    }
}
