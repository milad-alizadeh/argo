import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("See output — the gesture at rest") {
    if let output = RawOutput(WriteControlSpecimen.validationRefusal) {
        RawOutputDisclosure(output: output)
            .padding(ArgoSpacing.region)
            .argoAppearance()
    }
}
