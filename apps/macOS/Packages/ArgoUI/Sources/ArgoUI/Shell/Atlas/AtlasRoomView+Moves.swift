import ArgoDesign
import AtlasLayout
import AtlasView
import SwiftUI

/// The room's VERBS: what the reader's three ways of moving around the map resolve to, and
/// what the picture does about them — the city standing up out of its plates when a Map
/// arrives (#1421), and the camera flying to the plate they descend into (#1423).
///
/// Kept apart from the room's body because they are a different kind of thing: the body draws
/// where the reader IS, and these are how they get there and what it costs to arrive.
extension AtlasRoomView {
    /// The ground a plan is tiled into, inside the stage the room hands the map.
    ///
    /// `nonisolated` because `onGeometryChange` reads its measurement off the main actor: the
    /// arithmetic is two subtractions over a size and touches nothing this view owns.
    nonisolated static func stage(of size: CGSize) -> CGSize {
        CGSize(
            width: size.width - ArgoSpacing.loose * 2,
            height: size.height - ArgoSpacing.loose * 2,
        )
    }

    /// Fly the camera to the seat the reader's folder names, or cut where there is nothing to fly
    /// over (#1423).
    ///
    /// **THE CITY DOES NOT FLY**, which is `AtlasFit`'s rule at the seat and the prototype's at
    /// `goTo`: the city has a camera the reader drives — the orbit ball turns and tilts it — and a
    /// descent that flew it would take the view away from whoever was looking through it. There is
    /// no seat to fly to at that end, so this leaves `seat` nil and the fit frames the whole plan
    /// exactly as it did before. Reduce Motion cuts too, read off the role rather than decided
    /// here.
    ///
    /// **Nothing is written to start the flight FROM**, and that is the whole of why a second
    /// descent retargets rather than restarting. `AtlasView.animatableData` reports the seat the
    /// camera is at — the one this holds, or the one the folder names where it holds none — so the
    /// value SwiftUI interpolates away from is the frame it last DREW: the level the reader was on
    /// at rest, and the frame the camera had reached mid-flight. A seeded origin would be the
    /// restart from the old origin the ticket rules out.
    func fly(to there: String?, in map: AtlasMap) {
        guard !room.choice.arrangement.isCity.isOn, ground.width > 0, ground.height > 0 else {
            seat = nil
            return
        }
        let plan = AtlasStandpoint(on: map).plan(by: room.choice.channels, into: ground)
        let landing = AtlasSeat(standingIn: there, of: plan)
        guard landing.isDrawable,
              let animation = ArgoMotion.snap.resolved(reduceMotion: reduceMotion)
        else {
            seat = nil
            return
        }
        withAnimation(animation) { seat = landing }
    }

    /// What a rise is spent on: a Map, and whether there is a city to spend it on. Two facts
    /// rather than one, because the room OPENS at the flat end of the camera — a rise run there
    /// climbs heights a straight-down camera does not project, and the reader who then turns the
    /// city on gets it fully built, which is the sentence #1421 opens by complaining about.
    var arrival: AtlasArrival {
        AtlasArrival(measuredAt: measuredAt, isCity: room.choice.arrangement.isCity.isOn)
    }

    /// When the drawn Map was measured, or nothing where none is drawn.
    var measuredAt: Date? {
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
    @MainActor func stand() async {
        // Two ways the map is simply THERE, and both answered before the reset rather than by a
        // nil animation: the reset and the tick after it would otherwise put a flat map on screen
        // for a frame, which is the one thing either reader asked not to see.
        //
        // The treemap draws no heights, so `docs/designs/cockpit-atlas.html`'s own `rise()`
        // refuses to spend the role there — and Reduce Motion cuts, which is what
        // `ArgoMotion.rise` carrying no reduced duration means, read off the role rather than
        // decided here.
        guard room.choice.arrangement.isCity.isOn,
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

/// What the list beside the map is holding when a pick lands: the file rows, and whether the list
/// is showing them at all (#1155, #1158).
///
/// A pair rather than a bare array, because the one write that reads the array is only entitled to
/// it while the list really is a list of files — on a domain map the rail indexes subjects, and an
/// array of file rows there is a fact about a list nobody is looking at.
struct AtlasPickedList {
    let files: [AtlasIndexEntry]

    /// False where the rail is indexing SUBJECTS, so no row in it names a file at all.
    let selectsFiles: Bool
}

/// What the reader's three ways of moving around the map resolve to. Kept in an extension
/// because they are the room's WRITES: the body above draws, and each of these is the state
/// change one gesture means. The decision behind them is `AtlasPickRule`'s (#1156).
///
/// A region of a domain map is a Plate like any other by the time these see it, which is why none
/// of them mentions one: standing in a subject and standing in a folder are the same move to the
/// same kind of place (#1158).
extension AtlasRoomView {
    /// What a pick on the map means (#1153, #1154, #1155, #1156). The decision is
    /// `AtlasPickRule`'s, so it can be asked about without a window; what is left here is the
    /// three writes it resolves to.
    func pick(_ picked: AtlasTarget?, among entries: AtlasPickedList, in map: AtlasMap) {
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
    ///
    /// **The question survives where the list is not a list of files.** On a domain map the rail
    /// indexes SUBJECTS, so the sentence above has no purchase: there is no file row to select and
    /// no file row being denied, and clearing the words there would silently widen the reader's
    /// region filter for a reason that does not apply to it (#1158).
    func open(_ path: String, among entries: AtlasPickedList) {
        guard path != openFile else {
            openFile = nil
            return
        }
        openFile = path
        if entries.selectsFiles, !entries.files.contains(where: { $0.path == path }) {
            query = ""
        }
    }

    /// Go to a folder: the one verb behind a click on a plate, a crumb of the trail and the control
    /// back up (#1156). Three gestures, one move, so none of them can come to mean something
    /// slightly different from the others.
    ///
    /// **The camera is the whole of it** (#1490), and it FLIES rather than cutting (#1423). Nothing
    /// re-tiles: the picture is laid out from the repository's root once, so two consecutive frames
    /// of a descent are the same rectangles at two scales — which is precisely what makes a flight
    /// between them one similarity to interpolate rather than a second picture to cross-fade to.
    func descend(to path: String, in map: AtlasMap) {
        // The top of the trail is NO descent rather than a descent to the root: two spellings of
        // one place would leave the room with a state the trail and the picture read differently.
        folder = path == map.root.path ? nil : path
        let inside = AtlasStandpoint(on: map, standingIn: folder).inside
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
        fly(to: folder, in: map)
    }
}
