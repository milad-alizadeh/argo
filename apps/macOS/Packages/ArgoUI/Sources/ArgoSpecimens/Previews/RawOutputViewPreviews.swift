import ArgoUI
import SwiftUI

#Preview("Raw output — everything a refused write printed") {
    if let output = RawOutput(WriteControlSpecimen.validationRefusal) {
        RawOutputView(output: output)
            .argoAppearance()
    }
}
