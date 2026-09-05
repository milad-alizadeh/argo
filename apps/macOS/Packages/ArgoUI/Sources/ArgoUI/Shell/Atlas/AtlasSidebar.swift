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
/// The design's `AtlasControls` aside, minus the two rows other tickets own: Group by (#1158) and
/// Strongest ties (#1160).
///
/// Takes its value off the environment rather than as a parameter, for `AtlasRoomView`'s reason:
/// `argoAtlasRoom` is injected above the split view, so both columns read the same room.
package struct AtlasSidebar: View {
    @Environment(\.argo) private var argo
    @Environment(\.argoAtlasRoom) private var resolved
    @Environment(\.argoReduceMotion) private var reduceMotion

    /// Which room the strip is on. A binding, because the strip switches the whole window and this
    /// sidebar is only the column it starts in.
    @Binding var cockpitRoom: CockpitRoom

    package var body: some View {
        ScrollView(.vertical) {
            VStack(spacing: ArgoSpacing.flush) {
                sections
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .safeAreaInset(edge: .top, spacing: ArgoSpacing.flush) {
            // On the same vertical as the other two rooms' strips: a picker that lands a few
            // points apart between rooms reads as two controls (#816). Pinned above the scroll,
            // because it switches the window rather than belonging to this room's own content.
            RoomStrip(selection: $cockpitRoom)
        }
    }

    /// Nothing but the strip where no Map has been measured: every section here names a Measure or
    /// a number the measurement produced, and a Map that was never generated carries none. Three
    /// empty menus would be a control the reader cannot use and cannot fix from here — the room's
    /// own vacancy is what says how to fix it.
    @ViewBuilder private var sections: some View {
        if let room = resolved, case let .measured(map) = room.reading {
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
            AtlasFilters(hideTests: room.choice.hideTests.binding)
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
    package init(cockpitRoom: Binding<CockpitRoom>) {
        _cockpitRoom = cockpitRoom
    }
}
