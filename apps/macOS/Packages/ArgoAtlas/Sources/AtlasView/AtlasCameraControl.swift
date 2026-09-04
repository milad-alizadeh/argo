import ArgoAtoms
import ArgoDesign
import AtlasLayout
import SwiftUI

/// The reader's hand on the camera (#1152): turn and tilt the city, put it back where it opened,
/// and step between the city and the treemap. Three controls and one state each is bound to,
/// because none of the three is this view's own — a caller owns the orientation and the view
/// mode, and hands both back by reference so the same drag that turns the picture also turns the
/// name it is drawn under.
public struct AtlasCameraControl: View {
    @Environment(\.argo) private var argo

    @Binding private var orientation: AtlasOrientation
    @Binding private var isCity: Bool

    @FocusState private var orbitFocused: Bool
    @State private var dragBase: AtlasOrientation?

    /// Radians a point of drag turns the ball — the ball's own radius, so a drag across it is
    /// about a half-turn (the design's own `ORB_RATE`).
    private static let dragRate = 1.5 / 27.0
    /// Radians one arrow-key press turns by — 5°, the design's own `ORB_STEP`.
    private static let keyStep = Double.pi / 36
    /// Larger than `ArgoControlBox.icon` (26) on purpose — `ArgoControlBox`'s own doc allows a
    /// surface to draw its own box only where the number answers to something other than the
    /// button, and a drag target does: the design's own orbit ball is 54px across, wider than any
    /// click target in the app, because a thumb has to find it without first reading a label.
    private static let orbitBox: CGFloat = 44

    public init(orientation: Binding<AtlasOrientation>, isCity: Binding<Bool>) {
        self._orientation = orientation
        self._isCity = isCity
    }

    public var body: some View {
        HStack(spacing: ArgoSpacing.tight) {
            viewToggle
            ArgoIconButtonGroup {
                orbit
                ArgoIconButtonRule()
                reset
            }
        }
    }

    // MARK: - Turn and tilt

    /// The handle itself. Not a `Button` — a drag is not a click — but focusable and keyed the
    /// same as one, so Tab reaches it and the arrows drive it without a pointer ever touching it
    /// (#1152's "reachable from the keyboard, not the mouse alone").
    private var orbit: some View {
        ArgoGlyph(ArgoSymbol.atlasOrbit, .control)
            .argoControlFace(ArgoControlFace(box: Self.orbitBox, ink: argo.color.text.secondary))
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

    // MARK: - City / treemap

    private var viewToggle: some View {
        ArgoIconButtonGroup {
            toggleButton(title: "City", symbol: ArgoSymbol.atlasCity, selected: isCity) {
                isCity = true
            }
            ArgoIconButtonRule()
            toggleButton(title: "Treemap", symbol: ArgoSymbol.atlasTreemap, selected: !isCity) {
                isCity = false
            }
        }
    }

    private func toggleButton(
        title: String,
        symbol: String,
        selected: Bool,
        act: @escaping () -> Void,
    )
        -> some View {
        ArgoIconButton(
            symbol,
            voice: ArgoControlVoice(title),
            face: ArgoControlFace(
                ink: selected ? argo.color.text.primary : argo.color.text.tertiary,
            ),
            act: act,
        )
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

#Preview("Atlas camera control — the city, and the treemap") {
    @Previewable @State var cityOrientation = AtlasOrientation.opening
    @Previewable @State var cityIsCity = true
    @Previewable @State var flatOrientation = AtlasOrientation.opening
    @Previewable @State var flatIsCity = false

    VStack(spacing: ArgoSpacing.comfortable) {
        AtlasCameraControl(orientation: $cityOrientation, isCity: $cityIsCity)
        AtlasCameraControl(orientation: $flatOrientation, isCity: $flatIsCity)
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
