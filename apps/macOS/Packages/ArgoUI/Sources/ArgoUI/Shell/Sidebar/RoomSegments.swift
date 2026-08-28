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
/// It is the platform's control, not a restyle of it: arrow keys, focus, VoiceOver and the
/// untinted glass the running system draws all come with it. The selection is deliberately NOT
/// accent-filled — `selectedSegmentBezelColor` is ignored under Liquid Glass, and the raised glass
/// capsule is what Tahoe draws for a selected segment.
struct RoomSegments: NSViewRepresentable {
    @Binding var selection: CockpitRoom

    func makeNSView(context: Context) -> NSSegmentedControl {
        let control = NSSegmentedControl()
        control.segmentCount = CockpitRoom.allCases.count
        control.trackingMode = .selectOne
        control.segmentDistribution = .fillEqually
        control.target = context.coordinator
        control.action = #selector(Coordinator.pick(_:))
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
