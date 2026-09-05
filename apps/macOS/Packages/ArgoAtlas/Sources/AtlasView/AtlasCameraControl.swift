import ArgoAtoms
import ArgoDesign
import AtlasLayout
import SwiftUI

/// The reader's hand on the camera (#1152): turn and tilt the city, and put it back where it
/// opened. Two controls on a float over the map — the design's own `#orbit`
/// (`docs/designs/cockpit-atlas.html`), which is the only thing it puts over the stage.
///
/// Which of the two views is drawn is NOT here: the design makes that a row of the sidebar's
/// Arrangement section, beside the other things that decide what the map is (`AtlasArrangement`).
/// `isCity` is still taken because the ball is dead in the treemap, where there is nothing to
/// turn — but it is read here now, never written.
public struct AtlasCameraControl: View {
    @Environment(\.argo) private var argo

    @Binding private var orientation: AtlasOrientation
    private let isCity: Bool

    @FocusState private var orbitFocused: Bool
    @State private var dragBase: AtlasOrientation?

    /// Radians a point of drag turns the ball — the ball's own radius, so a drag across it is
    /// about a half-turn (the design's own `ORB_RATE`).
    private static let dragRate = 1.5 / 27.0
    /// Radians one arrow-key press turns by — 5°, the design's own `ORB_STEP`.
    private static let keyStep = Double.pi / 36
    public init(orientation: Binding<AtlasOrientation>, isCity: Bool) {
        self._orientation = orientation
        self.isCity = isCity
    }

    /// The ball and the way back, on one float. No rule between them and no group ground: they sit
    /// on the pill itself, which is the surface the design draws — one boundary over the map, not
    /// two inside it.
    public var body: some View {
        HStack(spacing: ArgoSpacing.tight) {
            orbit
            reset
        }
        .padding(ArgoSpacing.tight)
        // Rimmed, unlike most floats in this app: this one sits over a picture rather than over
        // the deck, and a map is the one ground a specular edge alone cannot be told from.
        .argoFloatingGlass(in: .rect(cornerRadius: ArgoRadius.popover), rim: argo.color.edge.subtle)
    }

    // MARK: - Turn and tilt

    /// The handle itself. Not a `Button` — a drag is not a click — but focusable and keyed the
    /// same as one, so Tab reaches it and the arrows drive it without a pointer ever touching it
    /// (#1152's "reachable from the keyboard, not the mouse alone").
    ///
    /// A LIT SPHERE, not a symbol: the design's `#orbc` is the model itself, turned down and given
    /// a handle, and an icon of a ball would report nothing about where the camera is standing.
    /// `AtlasOrbitBall` is what draws it.
    private var orbit: some View {
        AtlasOrbitBall(
            orientation: orientation,
            pigment: argo.color.atlas.materials.unassigned,
            // The design draws the plan square in a raw cyan no token of its own names. Snapped to
            // the nearest role rather than carried over as a number (house rule: no raw values).
            plan: argo.color.interaction.accentBright,
        )
        // A treemap seen from anywhere but straight down is neither view, so there is nothing here
        // to turn — the ball goes on reporting the camera, it just stops taking the hand.
        .opacity(isCity ? 1 : 0.45)
        .contentShape(.circle)
        .focusable()
        .focusEffectDisabled()
        .argoFocusRing(orbitFocused, in: Circle())
        .focused($orbitFocused)
        .disabled(!isCity)
        .gesture(dragToTurn)
        .onKeyPress(.leftArrow) { turn(yaw: -Self.keyStep, pitch: 0) }
        .onKeyPress(.rightArrow) { turn(yaw: Self.keyStep, pitch: 0) }
        .onKeyPress(.upArrow) { turn(yaw: 0, pitch: -Self.keyStep) }
        .onKeyPress(.downArrow) { turn(yaw: 0, pitch: Self.keyStep) }
        // Not a `Button`, so it carries no `ArgoControlVoice` of its own — `.help` is spent
        // directly, the same word VoiceOver gets below, so a pointer resting on it learns what
        // dragging it does the way the reset and toggle controls beside it already do.
        .help("Turn the model")
        .accessibilityElement()
        .accessibilityLabel("Turn the model")
        .accessibilityHint("Drag, or use the arrow keys, to turn and tilt the city.")
    }

    /// Anchored at the press, the way the approved design's own orbit ball is: every frame of the
    /// drag turns from the orientation the gesture STARTED at, so a long drag cannot accumulate
    /// drift the way summing each frame's own delta would.
    private var dragToTurn: some Gesture {
        DragGesture(minimumDistance: 1)
            .onChanged { value in
                guard isCity else { return }
                let base = dragBase ?? orientation
                if dragBase == nil {
                    dragBase = base
                }
                orientation = base.turned(
                    yaw: Double(value.translation.width) * Self.dragRate,
                    pitch: Double(value.translation.height) * Self.dragRate,
                )
            }
            .onEnded { _ in dragBase = nil }
    }

    private func turn(yaw deltaYaw: Double, pitch deltaPitch: Double) -> KeyPress.Result {
        guard isCity else { return .ignored }
        orientation = orientation.turned(yaw: deltaYaw, pitch: deltaPitch)
        return .handled
    }

    // MARK: - Reset

    private var reset: some View {
        ArgoIconButton(
            ArgoSymbol.reset,
            voice: ArgoControlVoice("Reset view", help: "Back to the opening view"),
            face: ArgoControlFace(ink: argo.color.text.tertiary),
            act: { orientation = .opening },
        )
    }
}

#Preview("Atlas camera control — the city, and the treemap") {
    @Previewable @State var cityOrientation = AtlasOrientation.opening
    @Previewable @State var flatOrientation = AtlasOrientation.opening

    VStack(spacing: ArgoSpacing.comfortable) {
        AtlasCameraControl(orientation: $cityOrientation, isCity: true)
        AtlasCameraControl(orientation: $flatOrientation, isCity: false)
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
