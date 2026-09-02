import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Tab line instruments — every access posture, and the state word") {
    VStack(alignment: .trailing, spacing: ArgoSpacing.section) {
        ForEach(
            Array((SessionHeaderFixture.headers + [SessionHeaderFixture.needsInput]).enumerated()),
            id: \.offset,
        ) { _, header in
            TabLineInstruments(header: header)
        }
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
