import ArgoDesign
import AtlasLayout
import AtlasView
import Foundation
import SwiftUI

/// The Atlas room: the map of the active Project, and the camera over it. Nothing else.
///
/// What makes a measurement checkable — how many files were found, which commit was measured, and
/// which Measure is on each channel — is the SIDEBAR's now (`AtlasSidebar`), which is where the
/// design puts it and where the controls that decide those channels already are. A map with no
/// numbers beside it is still a picture nobody can falsify; the numbers moved, they did not go.
struct AtlasRoomView: View {
    @Environment(\.argo) private var argo
    /// Injected from above the deck rather than taken as a parameter — `argoAtlasRoom` says why.
    @Environment(\.argoAtlasRoom) private var resolved
    @Environment(\.argoReduceMotion) private var reduceMotion
    /// What was written about this Project's files, or nothing said (#1159). Its own seam, read
    /// here and never mixed into the reading: the map, the tiling and every number beside it are
    /// the same whether this arrives or not.
    @Environment(\.argoAtlasNotes) private var notes

    /// Whether this is the room on screen. `InstrumentDeckShell` keeps every room mounted so a
    /// switch destroys nothing (#1356), which makes this the one thing that still tells the map's
    /// tiling and its Metal surface not to redraw for a reader who cannot see them — existence is
    /// no longer the gate, so activity has to be.
    var isActive = true

    /// The turn and tilt the reader has driven the city to (#1152) — held here rather than in
    /// `AtlasView`, which stays a pure function of what it is handed. Genuinely this column's own,
    /// unlike `isCity`: nothing in the sidebar turns the camera.
    @State private var orientation = AtlasOrientation.opening

    /// The file the reader has open beside the map, or none (#1154). This column's own, like the
    /// orientation and for the same reason: nothing in the sidebar opens a file, and what is open
    /// is a way of looking at the map rather than a fact about it — so it is not persisted and a
    /// reopened room opens on the whole shape.
    @State private var openFile: String?

    /// What the reader has typed into the rail's find field (#1155). This column's own for
    /// `openFile`'s reason, and not persisted for the same one: a question is a way of looking at
    /// the map rather than a fact about it, and a reopened room opens on the whole repository.
    @State private var query = ""

    /// The folder the reader has descended into, or none for the whole repository (#1156). This
    /// column's own, like `openFile`, and not persisted for the same reason: where you are in a map
    /// is a way of looking at it rather than a fact about the Project, and a reopened room opens on
    /// the whole shape.
    @State private var folder: String?

    /// How far the city has climbed out of its plates, 0 to 1 (#1421). This column's own, like the
    /// orientation: the rise is what the map DOES when it arrives, not a fact about the Project,
    /// and nothing in the sidebar starts one.
    @State private var rise: Double = 0

    /// What the room STARTS with — a file open, a question asked, a folder descended into. Nothing
    /// in the app ever passes any of them: a reading is opened by a click, a question is asked at a
    /// keyboard and a folder is entered by a click, and none of the three is a gesture a screenshot
    /// can drive. They are what let the specimen harness render those states at all — the design's
    /// own `?state=inspect` and `?state=search`, in the one shape SwiftUI has for seeding state a
    /// view then owns.
    init(isActive: Bool = true, opening: AtlasRoomOpening = .none) {
        self.isActive = isActive
        _openFile = State(initialValue: opening.opened)
        _query = State(initialValue: opening.typed)
        _folder = State(initialValue: opening.entered)
    }

    /// The room, or the one a window that has resolved none draws: a Project it has none of.
    private var room: AtlasRoom {
        resolved ?? AtlasRoom(
            reading: .noProject, project: nil, currency: AtlasCurrency {}, choice: .inert,
        )
    }

    var body: some View {
        Group {
            if case let .measured(map) = room.reading {
                if isActive {
                    measured(map)
                } else {
                    Color.clear
                }
            } else {
                AtlasRoomVacancy(
                    reading: room.reading,
                    project: room.project?.name,
                    rebuild: room.currency.rebuild,
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Escape closes the reading and unmarks the file (#1154): the mark and the panel are one
        // state, so there is one place to clear. `onExitCommand` rather than a key press, because
        // Escape is the platform's own way out of a thing and the responder chain is what knows
        // whether anything nearer wanted it first.
        .onExitCommand { openFile = nil }
        // Nothing survives a change of Project. A map is scoped to the window's Project
        // (ADR-0015), and a reading left standing would be one repository's file read beside
        // another repository's map.
        .onChange(of: room.project?.id) {
            openFile = nil
            query = ""
            folder = nil
        }
    }

    /// The stage: the map, and the camera floating over its top-right corner. Nothing else — what
    /// was measured and what it is drawn by are the sidebar's sections now, and the design puts no
    /// bar over the picture (`docs/designs/cockpit-atlas.html`, `#stage`).
    private func measured(_ map: AtlasMap) -> some View {
        // The Map as the reader's filters leave it — the same call the sidebar makes, so the
        // tiling and every number said about it cannot disagree about what was measured.
        let filtered = room.choice.drawn(map)
        // And then as their DESCENT leaves it: a Map of the folder they are in (#1156). One value
        // for the picture, the trail, the list and the reading, so all four are of one folder —
        // and the whole repository where the descent has gone out from under the reader, which is
        // what `descending(to:)` answering nothing means and where `trail(to:)` puts them too.
        let drawn = folder.flatMap { filtered.descending(to: $0) } ?? filtered
        let descent = AtlasDescent(trail: filtered.trail(to: folder)) {
            descend(to: $0, in: filtered)
        }
        // The list is read off the SAME Map the picture is tiled from, by the same filters, and
        // ONCE — both columns are handed this one answer, so the two can never disagree about
        // what is in the repository.
        let entries = drawn.index(matching: query, by: room.choice.channels)
        // The stage keeps the room it had: the rail takes its width off the end rather than
        // shrinking the map to nothing, and the map is what the reader clicked on.
        return HStack(spacing: ArgoSpacing.flush) {
            stage(drawn, among: entries, of: filtered)
            AtlasRoomRail(
                query: $query,
                descent: descent,
                entries: entries,
                open: openFile,
                reading: openFile.flatMap {
                    AtlasFileReading(of: $0, in: drawn, by: room.choice.channels)
                },
                // Looked up on the same path the reading is, and handed over separately: a file
                // nobody wrote about carries none, which is every file of a Project with no
                // written layer beside it.
                note: openFile.flatMap { notes.note(ofFile: $0) },
                select: { openFile = $0 },
            )
        }
    }

    /// `whole` is the Map before the descent, and the one a pick is answered against: a plate names
    /// a folder by its whole path, and where the reader is going is a place in the REPOSITORY
    /// rather than a place in the picture currently drawn.
    private func stage(
        _ drawn: AtlasMap, among entries: [AtlasIndexEntry], of whole: AtlasMap,
    )
        -> some View {
        ground(drawn, among: entries, of: whole)
            .overlay(alignment: .topTrailing) {
                // The design's own `#orbit`, floating over the stage rather than docked in a bar,
                // and inset from the corner by what the design insets it by.
                AtlasCameraControl(orientation: $orientation, isCity: room.choice.isCity.isOn)
                    .padding(ArgoSpacing.comfortable)
            }
    }

    /// The map, tiled into the room's own ground.
    ///
    /// Tiled in the BODY rather than inside the view, because a plan is recomputed when the size
    /// moves and a body is not a frame (ADR-0028 rule 3).
    ///
    /// The room ships at the FLAT end of the camera: the plates carry their names there, and a
    /// name is laid out in plan coordinates — turned, every caption would sit over a building it
    /// does not name, which is why the city draws with none.
    private func ground(
        _ map: AtlasMap, among entries: [AtlasIndexEntry], of whole: AtlasMap,
    )
        -> some View {
        GeometryReader { proxy in
            AtlasView(
                plan: AtlasPlan(
                    tiling: map,
                    by: room.choice.channels,
                    into: CGSize(
                        width: proxy.size.width - ArgoSpacing.loose * 2,
                        height: proxy.size.height - ArgoSpacing.loose * 2,
                    ),
                ),
                standing: AtlasStanding(relief: room.choice.isCity.isOn ? 1 : 0, rise: rise),
                orientation: orientation,
                marks: AtlasMarks(
                    focus: AtlasFocus(open: openFile) { pick($0, among: entries, in: whole) },
                    // The DRAWN Map's own ties, so hiding test files takes their cords with it:
                    // a cord to a file the map is not drawing has no box to end on (#1160).
                    ties: AtlasTies(
                        couplings: map.couplings, isOn: room.choice.filters.showTies.isOn,
                    ),
                ),
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .padding(ArgoSpacing.loose)
        // A Map arriving, and the reader turning the city on: the two moments there is a city to
        // stand up. Keyed on WHEN the Map was measured rather than on the plan, so a channel
        // change repaints and a filter re-tiles without the city reassembling — a model that
        // rebuilds every time the reader touches a menu is a loading screen.
        .task(id: arrival) { await stand() }
    }

    /// What a rise is spent on: a Map, and whether there is a city to spend it on. Two facts
    /// rather than one, because the room OPENS at the flat end of the camera — a rise run there
    /// climbs heights a straight-down camera does not project, and the reader who then turns the
    /// city on gets it fully built, which is the sentence #1421 opens by complaining about.
    private var arrival: AtlasArrival {
        AtlasArrival(measuredAt: measuredAt, isCity: room.choice.isCity.isOn)
    }

    /// When the drawn Map was measured, or nothing where none is drawn.
    private var measuredAt: Date? {
        guard case let .measured(map) = room.reading else { return nil }
        return map.measuredAt
    }

    /// The city stands up out of its plates (#1421). Every box starts flat and climbs to its
    /// measured height, staggered outwards from the middle of the plan — but none of that is here:
    /// this drives ONE scalar over the role's whole span, and the shader works each box's own
    /// phase out of it against where the box stands.
    ///
    /// `@MainActor` for `FeedIonLoop.run`'s reason: every line writes view state, and `.task`
    /// alone does not keep an `async` method on the main actor.
    @MainActor private func stand() async {
        // Two ways the map is simply THERE, and both answered before the reset rather than by a
        // nil animation: the reset and the tick after it would otherwise put a flat map on screen
        // for a frame, which is the one thing either reader asked not to see.
        //
        // The treemap draws no heights, so `docs/designs/cockpit-atlas.html`'s own `rise()`
        // refuses to spend the role there — and Reduce Motion cuts, which is what
        // `ArgoMotion.rise` carrying no reduced duration means, read off the role rather than
        // decided here.
        guard room.choice.isCity.isOn,
              let sweep = ArgoMotion.risen.sweep.resolved(reduceMotion: reduceMotion)
        else {
            rise = 1
            return
        }
        var cut = Transaction()
        cut.disablesAnimations = true
        withTransaction(cut) { rise = 0 }
        // A tick between the two, for `FeedIonLoop`'s reason: SwiftUI folds every change in one
        // tick into the last value, so a reset in the same tick as the climb leaves nothing to
        // animate — and a rebuild would then show no rise at all.
        try? await Task.sleep(for: .seconds(ArgoMotion.passReentry))
        withAnimation(sweep) { rise = 1 }
    }
}

/// What the reader's three ways of moving around the map resolve to. Kept in an extension
/// because they are the room's WRITES: the body above draws, and each of these is the state
/// change one gesture means. The decision behind them is `AtlasPickRule`'s (#1156).
extension AtlasRoomView {
    /// What a pick on the map means (#1153, #1154, #1155, #1156). The decision is
    /// `AtlasPickRule`'s, so it can be asked about without a window; what is left here is the
    /// three writes it resolves to.
    private func pick(_ picked: AtlasTarget?, among entries: [AtlasIndexEntry], in map: AtlasMap) {
        switch AtlasPickRule.outcome(of: picked, standingIn: folder ?? map.root.path) {
        case let .enter(path):
            descend(to: path, in: map)
        case let .read(path):
            open(path, among: entries)
        case .close:
            openFile = nil
        }
    }

    /// **A pick the question excludes puts the question away.** The list has to select the row of
    /// the file the map just marked, and it cannot select a row it is not drawing — so the
    /// narrower of the two facts gives. Clearing the reader's words is the visible answer; leaving
    /// them is a marked map beside a list denying the file exists, which is the one state #1155
    /// rules out.
    ///
    /// Picking the open file again closes it: what is open is open because the reader opened it,
    /// so the same gesture puts it away.
    private func open(_ path: String, among entries: [AtlasIndexEntry]) {
        guard path != openFile else {
            openFile = nil
            return
        }
        openFile = path
        if !entries.contains(where: { $0.path == path }) {
            query = ""
        }
    }

    /// Go to a folder: the one verb behind a click on a plate, a crumb of the trail and the control
    /// back up (#1156). Three gestures, one move, so none of them can come to mean something
    /// slightly different from the others.
    ///
    /// The camera is not touched, and that is the point of the criterion it answers: the map
    /// re-tiles into the same ground at the same turn and tilt, so the reader arrives looking at
    /// the folder from where they were looking at what held it. A descent that also moved the
    /// camera would answer the question "where am I" with "somewhere else again". The approved
    /// design flies between levels instead (`cockpit-atlas.html`, `goCrumb`); that is a move to
    /// make with the animation it needs, not a half of one.
    private func descend(to path: String, in map: AtlasMap) {
        // The top of the trail is NO descent rather than a descent to the root: two spellings of
        // one place would leave the room with a state the trail and the picture read differently.
        folder = path == map.root.path ? nil : path
        let inside = folder.flatMap { map.descending(to: $0) } ?? map
        if !AtlasPickRule.stays(openFile, on: inside) {
            openFile = nil
        }
        // The question goes with the level it was asked of, for the reason `open(_:among:)` clears
        // it: a question asked of the repository can leave a folder's list saying nothing here
        // matches, beside a map visibly full of that folder's files. The reader asked to be
        // SOMEWHERE
        // rather than to be shown fewer things, and the newer of the two answers is the one they
        // just gave.
        query = ""
    }
}

/// The two facts that decide whether a city has just arrived: which measurement is drawn, and
/// whether the camera is at the end that shows heights (#1421).
///
/// A value rather than two `onChange`s, so the rise has ONE trigger. Two would let a rebuild land
/// in the same frame as a flip and start the climb twice, from two different points.
///
/// The treemap-to-city turn is `ArgoMotion.lieDown`'s when that lands, and the two will have to be
/// reconciled there: a flip that also rises is one move too many.
private struct AtlasArrival: Equatable {
    let measuredAt: Date?
    let isCity: Bool
}
