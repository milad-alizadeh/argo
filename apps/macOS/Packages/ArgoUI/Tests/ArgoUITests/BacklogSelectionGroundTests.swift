import ArgoDesign
@testable import ArgoUI
import Testing

/// The backlog's selected row, on the SAME ground as every other selected row in the app
/// (#1165, reversing #1071's placement). `SelectionGroundTests` holds the ground itself — its
/// weight, its opacity, and the neutral ramp's readings on it; this suite holds what the backlog's
/// own row does with it, which is the part `BacklogRowInk` decides.
///
/// Its own suite rather than a section of that one: these are claims about one decision, and the
/// decision here is that the backlog has no ground of its own to decide anything about.
@Suite("Backlog selection ground")
struct BacklogSelectionGroundTests {
    static let palettes = ArgoPalette.all
    static let floor = ArgoPalette.TextRoles.contrastFloor
    /// What a MARK is held to, where a voice is held to `contrastFloor`. A glyph is not a word: the
    /// 3:1 is the same floor `SeriesRoles` states for a hue that has to be identified across a
    /// feed, and the trailing marks are read the same way.
    static let markFloor = 3.0

    /// The decision: one weight for one meaning. The backlog's selected row wears
    /// `interaction.selectionGround`, the roster's ground, rather than the accent at full strength
    /// — and it is the row's READING ground too, since the row draws it opaque.
    @Test(arguments: palettes)
    func `a selected backlog row is read on the quiet ground, as every other selected row is`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let ink = BacklogRowInk(isSelected: true, isRail: false, palette: appearance.palette)
        #expect(ink.readOn == appearance.palette.interaction.selectionGround)
    }

    /// An unselected row lays nothing, so what it is read on is the deck the pane draws. Named
    /// rather than left implicit, because the chips and marks measure against it.
    @Test(arguments: palettes)
    func `an unselected backlog row is read on the deck`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let ink = BacklogRowInk(isSelected: false, isRail: false, palette: appearance.palette)
        #expect(ink.readOn == appearance.palette.surface.base)
    }

    /// The ticket's own criterion, absolute and not relative: every voice a backlog row is set in
    /// clears the ramp's floor on the ground that row is read on. Both grounds, one loop — which is
    /// the whole point of the reversal, since #1071 needed a ground-dependent ink and this does
    /// not. The caption is exempt on BOTH: `text.disabled` is an absence rather than a voice, which
    /// is the reading `SelectionGroundTests` already holds on the deck.
    @Test(arguments: palettes)
    func `every voice a backlog row is set in clears the floor on both of its grounds`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        for isSelected in [true, false] {
            for isRail in [true, false] {
                let ink = BacklogRowInk(
                    isSelected: isSelected, isRail: isRail, palette: appearance.palette,
                )
                for voice in [ink.title, ink.machine] {
                    #expect(voice.contrastRatio(on: ink.readOn) >= Self.floor)
                }
            }
        }
    }

    /// The neutral ramp is back, unchanged by selection — the GROUND is what says a row is
    /// selected, exactly as it does in the roster (D30). #1071's `text.onAccent` on all three
    /// voices went with the loud rung it was named for, and with it the flattening of the row's
    /// hierarchy into face and size alone.
    @Test(arguments: palettes)
    func `selection changes the row's ground and none of its voices`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        for isRail in [true, false] {
            let selected = BacklogRowInk(isSelected: true, isRail: isRail, palette: palette)
            let unselected = BacklogRowInk(isSelected: false, isRail: isRail, palette: palette)
            #expect(selected.title == unselected.title)
            #expect(selected.machine == unselected.machine)
            #expect(selected.caption == unselected.caption)
        }
        let ink = BacklogRowInk(isSelected: true, isRail: false, palette: palette)
        #expect(ink.title == palette.text.secondary)
        #expect(ink.machine == palette.text.tertiary)
        #expect(ink.caption == palette.text.disabled)
    }

    /// A rail is on screen for a descendant's sake rather than for its own match, so its title
    /// takes the demotion the `#id` beside it already carries (#873). On the loud rung there was no
    /// quieter rung to demote to and the demotion was dropped; on the quiet ground it comes back,
    /// and a selected rail reads exactly as an unselected one does.
    @Test(arguments: palettes)
    func `a rail keeps its demotion while selected`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        let rail = BacklogRowInk(isSelected: true, isRail: true, palette: palette)
        #expect(rail.title == palette.text.tertiary)
    }

    /// What the row's marks are, and what makes them legible: they carry the Route's own inks, and
    /// on this ground each is read within a hair of its reading on the deck. That is what retires
    /// the plate #1071 laid under them — on the accent at full strength the same two inks read at
    /// 1.2:1, and nothing but an opaque backdrop could save them.
    @Test(arguments: palettes)
    func `the trailing marks' inks clear the mark floor on both of a row's grounds`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        for ground in [palette.surface.base, palette.interaction.selectionGround] {
            for ink in [palette.state.running, palette.state.failure, palette.state.idle] {
                #expect(ink.contrastRatio(on: ground) >= Self.markFloor)
            }
            // And the reading the plate was there for is the one it cannot survive: on the accent
            // at full strength these are under 1.6:1, which is why the loud rung needed one.
            #expect(palette.state.failure
                .contrastRatio(on: palette.interaction.accent) < Self.markFloor)
        }
    }

    /// The stranded mark is the one exemption, stated rather than discovered: it is drawn in
    /// `text.disabled` because a blocker that was ruled out is an ABSENCE, and it reads under the
    /// mark floor on the deck already. The quiet ground neither introduces that nor worsens it into
    /// a different kind of thing — the tooltip is what carries the fact either way.
    @Test(arguments: palettes)
    func `the stranded mark is a deliberate absence on both grounds`(
        _ appearance: (name: String, palette: ArgoPalette),
    ) {
        let palette = appearance.palette
        for ground in [palette.surface.base, palette.interaction.selectionGround] {
            #expect(palette.text.disabled.contrastRatio(on: ground) < Self.markFloor)
        }
    }
}
