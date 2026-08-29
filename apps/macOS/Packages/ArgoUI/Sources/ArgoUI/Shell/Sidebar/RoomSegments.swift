import AppKit
import SwiftUI

/// The rooms segmented control, as AppKit's own rather than SwiftUI's.
///
/// Two things SwiftUI's segmented `Picker` cannot do on macOS 26, and both are the reason this
/// exists rather than a wish to restyle anything:
///
/// - **`segmentDistribution`.** SwiftUI never exposes it, so the control sits at its fitting width
///   and `.frame(maxWidth: .infinity)` only centres something that hugs its three words.
///   `.fillEqually` is the whole difference.
/// - **A mark AND a word on one segment.** `.segmented` draws one or the other on macOS; AppKit's
///   control draws both, which is what puts each room's own glyph back beside its name.
///
/// It is the platform's control, not a restyle of it: arrow keys, focus, VoiceOver and the glass
/// the running system draws all come with it. One thing about its APPEARANCE is set, and both
/// halves of why are AppKit behaviour measured on macOS 26.5.1 (#944):
///
/// - **Left alone, the control fills the selected segment from the `AccentColor` asset** — which
///   carries Ion Blue at full strength. It does not draw an untinted capsule, and it does not read
///   the system's `controlAccentColor`.
/// - **`selectedSegmentBezelColor` is honoured under Liquid Glass.** Set it and the fill takes that
///   colour, at every `segmentStyle`.
///
/// So the segment takes `surface.selected`, the neutral the contract reserves for a control that is
/// current, and the brand hue stays on the roster's selected row alone (D30 as amended by #944).
struct RoomSegments: NSViewRepresentable {
    @Binding var selection: CockpitRoom

    @Environment(\.argo) private var argo

    func makeNSView(context: Context) -> NSSegmentedControl {
        let control = Self.makeControl(palette: argo.color)
        control.target = context.coordinator
        control.action = #selector(Coordinator.pick(_:))
        return control
    }

    /// Which role the fill takes, in the one place both the build and the update reach for it.
    @MainActor static func bezel(_ control: NSSegmentedControl, from palette: ArgoPalette) {
        control.selectedSegmentBezelColor = palette.surface.selected.nsColor
    }

    /// The control without its target, so a test can hold one — `makeNSView` alone is unreachable
    /// from a test, because nothing can build a `Context`.
    @MainActor static func makeControl(palette: ArgoPalette) -> NSSegmentedControl {
        let control = NSSegmentedControl()
        control.segmentCount = CockpitRoom.allCases.count
        control.trackingMode = .selectOne
        control.segmentDistribution = .fillEqually
        bezel(control, from: palette)
        // Without this the control reports its fitting width as its ideal and SwiftUI hands it
        // exactly that, which is the same hugging the stock picker does.
        control.setContentHuggingPriority(.defaultLow, for: .horizontal)
        // The glyph reads as the room's own mark only while it sits with the word — the symbol is
        // template art, so it takes the segment's own foreground rather than a colour named here.
        //
        // The shortcut rides on the image's description and the segment's tooltip, because
        // `NSSegmentedControl` exposes no per-segment accessibility label — there is no
        // `setAccessibilityLabel(_:forSegment:)`. A titled segment announces its title, so the
        // description is a floor rather than the whole answer; the Navigate menu carries the same
        // shortcut, and it is the one surface that can state it outright.
        for (index, room) in CockpitRoom.allCases.enumerated() {
            let mark = NSImage(
                systemSymbolName: room.symbol, accessibilityDescription: room.voiceOverLabel,
            )
            mark?.isTemplate = true
            control.setImage(mark, forSegment: index)
            control.setImageScaling(.scaleProportionallyDown, forSegment: index)
            control.setLabel(room.title, forSegment: index)
            control.setToolTip(room.tooltip, forSegment: index)
        }
        return control
    }

    func updateNSView(_ control: NSSegmentedControl, context: Context) {
        context.coordinator.selection = $selection
        Self.bezel(control, from: argo.color)
        control.selectedSegment = CockpitRoom.allCases.firstIndex(of: selection) ?? 0
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(selection: $selection)
    }

    /// Where the control's one target-action lands. It holds the binding rather than the view so a
    /// click during a body pass writes to the binding the pass installed.
    @MainActor final class Coordinator: NSObject {
        var selection: Binding<CockpitRoom>

        init(selection: Binding<CockpitRoom>) {
            self.selection = selection
        }

        @objc func pick(_ sender: NSSegmentedControl) {
            let rooms = CockpitRoom.allCases
            guard rooms.indices.contains(sender.selectedSegment) else { return }
            selection.wrappedValue = rooms[sender.selectedSegment]
        }
    }
}
