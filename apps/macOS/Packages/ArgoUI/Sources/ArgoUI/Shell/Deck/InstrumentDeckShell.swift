import SwiftUI

/// The flush graphite ground that later room slices fill without introducing cards or fake state.
struct InstrumentDeckShell: View {
    let room: CockpitRoom

    var body: some View {
        Color.clear
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
            .accessibilityElement()
            .accessibilityLabel("\(room.title) Instrument Deck")
    }
}

#Preview("Instrument Deck ground") {
    InstrumentDeckShell(room: .sessions)
        .frame(width: 860, height: 620)
        .argoAppearance()
}
