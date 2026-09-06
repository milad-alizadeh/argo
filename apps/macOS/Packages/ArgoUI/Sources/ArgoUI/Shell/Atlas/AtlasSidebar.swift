import ArgoAtoms
import ArgoDesign
import AtlasLayout
import AtlasView
import SwiftUI

/// The Atlas room's sidebar: the room strip, then how the map is arranged, what it measures, what
/// is left off it, what the colour is worth, and where the whole thing came from (#1161).
///
/// The window's own leading column, the way the Sessions roster and the Tickets views are — not a
/// panel inside the room. The rail is the ROOM's (`CockpitView.sidebar`), so the controls that
/// decide what the map draws belong in it, on the sidebar material the platform draws there, at
/// the width the reader has already dragged the other two rooms to.
///
/// The design's `AtlasControls` aside, minus the one row another ticket owns: Group by (#1158).
///
/// Takes the room as a PARAMETER, unlike `AtlasRoomView`, which reads `argoAtlasRoom` (#1489).
/// This is the one view whose caller has the room in hand: the rail is the shell's own leading
/// column, assembled where `atlasRoom` is. Down the environment it was injected on the DETAIL
/// column, which is this column's sibling and reaches nothing here — so the sidebar drew its strip
/// and no section however much had been measured, and the compiler had nothing to say about it.
///
/// Injecting it above both columns instead answers that and costs the roster: the room is a fresh
/// non-`Equatable` value on every pass, so an entry read across the split re-runs the leading
/// column whole, and the roster's own reads go up with it (`SessionSelectionCostTests`, ADR-0028
/// Rule 3). A parameter reaches this view and nothing beside it.
package struct AtlasSidebar: View {
    @Environment(\.argo) private var argo
    @Environment(\.argoReduceMotion) private var reduceMotion

    /// The room this column's controls decide. `nil` is a window that has resolved NONE — a
    /// preview, and every room but this one — which `AtlasRoomView` draws as the Project it has
    /// none of.
    let resolved: AtlasRoom?

    /// Which room the strip is on. A binding, because the strip switches the whole window and this
    /// sidebar is only the column it starts in.
    @Binding var cockpitRoom: CockpitRoom

    package var body: some View {
        // The strip sits above the scroll and not in it, because it switches the window rather
        // than belonging to this room's own content — and on the same vertical as the other rooms',
        // which is `RoomSidebar`'s whole job (#816). It was a `safeAreaInset` here and is now the
        // stack's first child, so this rail's sections no longer scroll under the strip. That is
        // the trade for one placement: the other rooms never did.
        RoomSidebar(room: $cockpitRoom) {
            ScrollView(.vertical) {
                VStack(spacing: ArgoSpacing.flush) {
                    sections
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    /// Nothing but the strip where no Map has been measured: every section here names a Measure or
    /// a number the measurement produced, and a Map that was never generated carries none. Three
    /// empty menus would be a control the reader cannot use and cannot fix from here — the room's
    /// own vacancy is what says how to fix it.
    ///
    /// Nothing either where this is not the room on screen, which is `AtlasRoomView.isActive`'s
    /// reason and now the sidebar's too (#1489): the column stays mounted through a room switch
    /// (#1356), and the room it hands down is a fresh value on every pass of the shell — so a
    /// filter over the whole Map would be re-run for a reader who is in Sessions and cannot see any
    /// of it.
    ///
    /// What it costs is the scroll: the sections leave the scroll view rather than being hidden in
    /// it, so a rail scrolled to Repository data opens at the top on the way back. Paid rather than
    /// avoided, because the five sections stand in a column the window is taller than — there is
    /// usually nothing to scroll — and the alternative is a pass over every file in the repository
    /// on every line a Session in another room streams.
    @ViewBuilder private var sections: some View {
        if cockpitRoom == .atlas, let room = resolved, case let .measured(map) = room.reading {
            // The map as it is DRAWN, through the choice's own filter rather than this column's
            // spelling of it. Every section below reads the filtered set, so the legend's ends and
            // the file count move with the filter the way the tiles do (#1161).
            let drawn = room.choice.drawn(map)

            AtlasArrangement(isCity: laidDown(room.choice.isCity))
            divider
            AtlasEncoding(
                // The UNFILTERED Map's Measures, unlike everything else in this column: a Measure
                // is what the generator recorded, not a property of which files are left standing,
                // and reading the names off `drawn` lets the filter take an option out of the menu
                // the reader would use to get back.
                measures: map.measureNames,
                channels: Binding(
                    get: { room.choice.channels }, set: room.choice.setChannels,
                ),
            )
            divider
            AtlasFilters(
                hideTests: room.choice.filters.hideTests.binding,
                showTies: room.choice.filters.showTies.binding,
            )
            divider
            // Banded here rather than read off the plan: both ends come from the banding and none
            // of them from the rectangles, so the key costs a pass over the Measure and never a
            // second tiling of the map.
            AtlasLegendKey(
                legend: AtlasLegend(
                    measure: room.choice.channels.band,
                    over: AtlasBanding(of: room.choice.channels.band, over: drawn),
                ),
                measure: argo.color.atlas.measure,
            )
            divider
            AtlasRepositoryData(
                map: drawn,
                behind: room.currency.behind,
                rebuild: room.currency.rebuild,
            )
        }
    }

    /// The view switch, wrapped so the step between the city and the treemap carries an animation
    /// `AtlasView` can tween `relief` through — plain assignment changes the value with nothing to
    /// interpolate between the old picture and the new one. Nil under Reduce Motion, which is
    /// `lieDown`'s own answer to it (#1152's "reduced motion is honoured: the transition becomes
    /// instant"). The role rather than a general purpose one, and why, on `ArgoMotion.lieDown`
    /// (#1422).
    private func laidDown(_ view: AtlasSwitch) -> Binding<Bool> {
        Binding(
            get: { view.isOn },
            set: { newValue in
                withAnimation(ArgoMotion.lieDown.resolved(reduceMotion: reduceMotion)) {
                    view.set(newValue)
                }
            },
        )
    }

    private var divider: some View {
        ArgoRule(ink: argo.color.edge.hairline)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(room: AtlasRoom?, cockpitRoom: Binding<CockpitRoom>) {
        self.resolved = room
        _cockpitRoom = cockpitRoom
    }
}
