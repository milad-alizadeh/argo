import ArgoDesign
import AtlasLayout
import SwiftUI

/// The co-change ties, drawn on the map (#1160), arriving and leaving on a clock with light
/// passing through them (#1425).
///
/// The map shows how big and how bad; the cords show what moves with what — the coupling no import
/// declares. Two readings out of one counting: the strongest across the whole picture while the
/// switch is on, and the open file's own whatever it is set to.
///
/// Over the Metal surface rather than in the shader, for `AtlasOpenTrace`'s reason: the GPU draws
/// faces, and a curve across a projected picture is the one thing a triangle rasteriser has no
/// cheap answer for. The geometry is `AtlasCord`, which reads the same camera and the same fit the
/// surface hands the GPU, so a cord cannot land where its two files are not.
///
/// Over the model rather than into it, too: a cord that disappeared behind a tower would be a tie
/// the reader is told about from some angles and not from others.
///
/// **This half CHOOSES the cords and holds the two clocks; `AtlasDrawnCords` spends them.** The
/// split is what keeps the choosing off the animated path: the whole-map reading sorts 18,402
/// couplings and seats 2,705 tiles, and a body that re-ran once a frame would do that sixty times
/// a second for as long as a reader rested the pointer on the map.
struct AtlasTieCords: View {
    @Environment(\.argoReduceMotion) private var reduceMotion

    /// The same projection the surface underneath was drawn with, which is the whole of why the
    /// cords cannot land where the volumes are not.
    let projection: AtlasProjection
    /// Every tie the drawn Map carries, and whether the whole-map reading was asked for.
    let ties: AtlasTies
    /// The file the reader has open, whose own ties are drawn however the switch is set.
    let open: String?
    /// Whether the pointer is on the map, which is the whole of what the travel runs on.
    let travelling: Bool

    /// Whether the whole-map layer is on the frame AT ALL — the switch, held on through the fade
    /// out. A boolean rather than a reading of `layer` below: this is what decides whether the
    /// expensive choosing happens, and deciding it off an animated number would put that choosing
    /// back on the animated path.
    ///
    /// It is what there is to fade out: a set recomputed from the switch alone would be empty on
    /// the first frame of the fade, and there would be nothing left on screen to take away.
    @State private var drawing = false

    /// How present that layer is, 0 to 1, over `ArgoMotion.layerFade` (#1425). A cut at the size of
    /// a hundred and sixty cords reads as the map being replaced rather than as it answering the
    /// question.
    ///
    /// It governs the whole-map reading ALONE, the way the switch it follows does: the open file's
    /// own cords answer a question the reader just asked by clicking, and a question answered on a
    /// fade is a click that did not land.
    @State private var layer: Double = 0

    /// Where the lap has got to, 0 to 1, going round for as long as the reader is on the map.
    @State private var lap: Double = 0

    var body: some View {
        AtlasDrawnCords(
            cords: AtlasDrawnCord.all(of: ties.shown(drawing), open: open, through: projection),
            viewport: projection.viewport,
            travelling: isTravelling,
            clock: AtlasCordClock(layer: layer, lap: lap),
        )
        .task(id: ties.isOn) { await settle() }
        .task(id: isTravelling) { await run() }
    }

    /// Whether light should be moving along the cords at all: a reader on the map, and movement
    /// left on. `ArgoMotion.travel` carries no reduced duration, which is a loop's only honest
    /// answer to Reduce Motion — it stops, and the still cords still say what depends on what.
    private var isTravelling: Bool {
        travelling && !reduceMotion
    }

    /// The layer arriving or leaving, on the switch. `resolved` answering nothing is Reduce
    /// Motion's cut, read off the role rather than decided here.
    ///
    /// Going away is two steps and not one: the fade runs, and only when it has finished does the
    /// layer stop being chosen. Dropping it at the start would take the cords off the frame before
    /// the fade had anything to fade.
    @MainActor private func settle() async {
        if ties.isOn {
            drawing = true
        }
        let present: Double = ties.isOn ? 1 : 0
        guard let fade = ArgoMotion.layerFade.resolved(reduceMotion: reduceMotion) else {
            layer = present
            drawing = ties.isOn
            return
        }
        withAnimation(fade) { layer = present }
        guard !ties.isOn else { return }
        try? await Task.sleep(for: .seconds(ArgoMotion.layerFade.duration))
        guard !Task.isCancelled else { return }
        drawing = false
    }

    /// The lap, going round for as long as the reader is on the map. One clock for every cord, with
    /// each cord's own place in the lap spent in `AtlasTravel`: a second clock would be a third
    /// repeating role, and the contract has two (`MotionContractTests`).
    ///
    /// A pass at a time rather than `repeatForever`, for `FeedIonLoop`'s reason. It starts each run
    /// from the START of a lap: cancelling this task does not cancel the animation it left running,
    /// so a lap the reader walked away from has finished by the time they come back — and a run
    /// that animated to a value already reached would animate nothing and then sleep 5.2 seconds in
    /// front of a frozen light. Nothing is drawn between the two, so the reset is not seen.
    @MainActor private func run() async {
        guard isTravelling else { return }
        var reentry = Transaction()
        reentry.disablesAnimations = true
        while !Task.isCancelled {
            withTransaction(reentry) { lap = 0 }
            // A tick between the reset and the lap: SwiftUI folds every change in one tick into
            // the last value, so a reset in the same tick as the lap leaves nothing to animate.
            try? await Task.sleep(for: .seconds(ArgoMotion.passReentry))
            guard !Task.isCancelled,
                  let pass = ArgoMotion.travel.resolvedPass(reduceMotion: reduceMotion)
            else {
                return
            }
            withAnimation(pass) { lap = 1 }
            try? await Task.sleep(for: .seconds(ArgoMotion.travel.duration))
        }
    }
}

extension AtlasTies {
    /// The same ties, with the whole-map reading asked for or not. What the fade drives instead of
    /// the switch: a layer is still drawn while it is going away.
    func shown(_ isOn: Bool) -> AtlasTies {
        AtlasTies(couplings: couplings, isOn: isOn)
    }
}

extension AtlasCordWeight {
    /// How much of this weight's material is on the frame while the whole-map layer is at
    /// `presence`. The open file's own cords are not that layer and do not fade with it.
    func presence(_ presence: Double) -> Double {
        switch self {
        case .acrossTheMap: presence
        case .ofTheOpenFile: 1
        }
    }
}
