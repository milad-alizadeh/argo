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
    @Environment(\.argoReduceMotion) var reduceMotion
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
    @State var openFile: String?

    /// What the reader has typed into the rail's find field (#1155). This column's own for
    /// `openFile`'s reason, and not persisted for the same one: a question is a way of looking at
    /// the map rather than a fact about it, and a reopened room opens on the whole repository.
    @State var query = ""

    /// The folder the reader has descended into, or none for the whole repository (#1156). This
    /// column's own, like `openFile`, and not persisted for the same reason: where you are in a map
    /// is a way of looking at it rather than a fact about the Project, and a reopened room opens on
    /// the whole shape.
    @State var folder: String?

    /// How far the city has climbed out of its plates, 0 to 1 (#1421). This column's own, like the
    /// orientation: the rise is what the map DOES when it arrives, not a fact about the Project,
    /// and nothing in the sidebar starts one.
    @State var rise: Double = 0

    /// Where the camera actually is, while it is somewhere `folder` does not name (#1423). Nothing
    /// at rest, when the folder names the seat and there is no flight in the air.
    ///
    /// This column's own, like the orientation: a flight is what the map DOES about a descent, not
    /// a fact about the Project, and nothing in the sidebar starts one.
    @State var seat: AtlasSeat?

    /// The ground the map is tiled into, read off the stage. Kept here because a flight has to know
    /// the seat it is flying to, and a seat is measured on a plan — which needs a size only the
    /// stage has.
    @State var ground = CGSize.zero

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
    var room: AtlasRoom {
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
        // A seat is measured against a PLAN, so anything that lays out a new one leaves it aimed
        // at where a plate used to be. The ground is watched where it is measured; these are the
        // reader's own two ways of re-tiling — a channel decides the footprint every rect is
        // sized by, and hiding test files re-reads the repository without them (#1161).
        .onChange(of: room.choice.channels) { seat = nil }
        .onChange(of: room.choice.filters.hideTests.isOn) { seat = nil }
        // Re-tiling takes the descent AND the seat with it (#1158). Where the reader was standing
        // was a folder of the OTHER reading, and the map they are now looking at holds no such
        // place — a trail naming it would name a plate nothing on screen draws, and a seat aimed
        // at it is a camera pointed where a plate used to be. The open file survives: it is the
        // same file, still on the map, and it is what the reader was reading about.
        .onChange(of: room.choice.arrangement.grouping) {
            folder = nil
            seat = nil
        }
        .onChange(of: room.project?.id) {
            openFile = nil
            query = ""
            folder = nil
            seat = nil
        }
    }

    /// The stage: the map, and the camera floating over its top-right corner. Nothing else — what
    /// was measured and what it is drawn by are the sidebar's sections now, and the design puts no
    /// bar over the picture (`docs/designs/cockpit-atlas.html`, `#stage`).
    private func measured(_ map: AtlasMap) -> some View {
        // The Map as the reader's filters leave it, ARRANGED the way they asked, and where their
        // descent leaves them standing on it (#1490, #1158). ONE value, and the one place that
        // says the tiling comes from the Map and never from the folder — the same call the sidebar
        // makes, so the tiling and every number said about it cannot disagree about what was
        // measured or about how it is arranged.
        //
        // A region of a domain map is a Plate like any other by the time it reaches here, which is
        // what lets everything below go on working unchanged: standing in one, trailing back out
        // of it and indexing what stands on it are the same three verbs, over a Map whose folders
        // happen to have been guessed.
        let standpoint = AtlasStandpoint(on: room.choice.drawn(map), standingIn: folder)
        let descent = AtlasDescent(trail: standpoint.trail) {
            descend(to: $0, in: standpoint.map)
        }
        // The list is of the folder the reader is IN, read once and handed to both columns, so the
        // two can never disagree about what is in it. The picture is of the whole repository and
        // seated on that folder, which is what leaves them agreeing about where the reader is
        // without the map having re-tiled to say so.
        let entries = standpoint.inside.index(matching: query, by: room.choice.channels)
        // And the regions of a domain map, off the same Map by the same question (#1158). Asked of
        // where the reader IS: at the top of a domain map the list is of subjects, and inside one
        // region it is of that region's files, which is what there is to look at.
        //
        // Whether it indexes subjects at ALL is asked without the question, because a question
        // matching no region has not stopped the map being tiled by subject.
        let regions = standpoint.inside.domainIndex(matching: query)
        let indexesDomains = !standpoint.inside.regions.isEmpty
        // The stage keeps the room it had: the rail takes its width off the end rather than
        // shrinking the map to nothing, and the map is what the reader clicked on.
        // What a pick on the map is answered against: the file rows, and whether the rail is
        // showing them at all. The second half is what entitles a pick to touch the reader's
        // question, which on a domain map it must not (#1158).
        let picked = AtlasPickedList(files: entries, selectsFiles: !indexesDomains)
        return HStack(spacing: ArgoSpacing.flush) {
            stage(standpoint, among: picked)
            AtlasRoomRail(
                query: $query,
                descent: descent,
                entries: entries,
                regions: regions,
                indexesDomains: indexesDomains,
                open: openFile,
                // Looked up in the Map the PICTURE draws, not the folder's (#1490). The two were
                // one Map while a descent re-rooted the tiling; they are not now, and a file
                // outside the folder is still on screen and still clickable — at the city end,
                // where nothing seats, and flat wherever the seat's bound leaves siblings in
                // frame. Asked of the folder, every one of those picks marked a file on the map
                // and put an empty panel beside it.
                reading: openFile.flatMap {
                    AtlasFileReading(of: $0, in: standpoint.map, by: room.choice.channels)
                },
                // Looked up on the same path the reading is, and handed over separately: a file
                // nobody wrote about carries none, which is every file of a Project with no
                // written layer beside it.
                note: openFile.flatMap { notes.note(ofFile: $0) },
                select: { openFile = $0 },
                unassigned: standpoint.inside.unassigned.count,
            )
        }
    }

    /// A pick is answered against the standpoint's whole Map: a plate names a folder by its whole
    /// path, and where the reader is going is a place in the REPOSITORY rather than a place in the
    /// picture currently drawn.
    private func stage(
        _ standpoint: AtlasStandpoint, among entries: AtlasPickedList,
    )
        -> some View {
        ground(standpoint, among: entries)
            .overlay(alignment: .topTrailing) {
                // The design's own `#orbit`, floating over the stage rather than docked in a bar,
                // and inset from the corner by what the design insets it by.
                AtlasCameraControl(
                    orientation: $orientation,
                    isCity: room.choice.arrangement.isCity.isOn,
                )
                .padding(ArgoSpacing.comfortable)
            }
    }

    /// The map, tiled into the room's own ground — from the repository's root, at every depth
    /// (#1490). Where the reader is standing goes to the view as the folder it is, and moves the
    /// camera there rather than the tiling.
    ///
    /// Tiled in the BODY rather than inside the view, because a plan is recomputed when the size
    /// moves and a body is not a frame (ADR-0028 rule 3).
    ///
    /// The room ships at the FLAT end of the camera: the plates carry their names there, and a
    /// name is laid out in plan coordinates — turned, every caption would sit over a building it
    /// does not name, which is why the city draws with none.
    private func ground(
        _ standpoint: AtlasStandpoint, among entries: AtlasPickedList,
    )
        -> some View {
        GeometryReader { proxy in
            AtlasView(
                plan: standpoint.plan(
                    by: room.choice.channels,
                    into: Self.stage(of: proxy.size),
                    // What the regions ARE, so the tiler can put each file's Domain on its tile
                    // and the map can be painted by it — the one fact a Map re-rooted on its
                    // Domains no longer says by its shape alone (#1158). Held against what THIS
                    // Map can answer, which is the same call every other column makes.
                    grouping: room.choice.grouping(of: standpoint.map),
                ),
                viewpoint: AtlasViewpoint(
                    standing: AtlasStanding(
                        relief: room.choice.arrangement.isCity.isOn ? 1 : 0,
                        rise: rise,
                    ),
                    orientation: orientation,
                    standingIn: standpoint.folder,
                    seat: seat,
                ),
                marks: AtlasMarks(
                    focus: AtlasFocus(open: openFile) {
                        pick($0, among: entries, in: standpoint.map)
                    },
                    // The FILTERED Map's own ties, so hiding test files takes their cords with it:
                    // a cord to a file the map is not drawing has no box to end on (#1160). Not
                    // the folder's — the picture is of the whole repository now, and a cord that
                    // left the folder used to end nowhere.
                    ties: AtlasTies(
                        couplings: standpoint.map.couplings,
                        isOn: room.choice.filters.showTies.isOn,
                    ),
                ),
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        // Measured where the map is TILED rather than where the stage is padded, and through the
        // one function the tiling above reads: a flight seated against a ground half a point wider
        // than the plan was laid out in is a camera aimed slightly wrong.
        .onGeometryChange(for: CGSize.self) { Self.stage(of: $0.size) } action: {
            ground = $0
            // A landed seat was measured on the ground it landed on, so a resize makes it a camera
            // aimed at where a plate USED to be. Dropped rather than re-solved: nil is the seat the
            // folder names, which is the same picture and cannot go stale.
            seat = nil
        }
        .padding(ArgoSpacing.loose)
        // A Map arriving, and the reader turning the city on: the two moments there is a city to
        // stand up. Keyed on WHEN the Map was measured rather than on the plan, so a channel
        // change repaints and a filter re-tiles without the city reassembling — a model that
        // rebuilds every time the reader touches a menu is a loading screen.
        .task(id: arrival) { await stand() }
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
struct AtlasArrival: Equatable {
    let measuredAt: Date?
    let isCity: Bool
}
