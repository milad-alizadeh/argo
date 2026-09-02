import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("New Session button") {
    NewSessionButton(offer: NewSessionOffer(presentation: .preview), spawn: {})
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("New Session button — nothing registered") {
    NewSessionButton(offer: NewSessionOffer(presentation: .unregisteredPreview), spawn: {})
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("New Session button — a spawn in flight") {
    NewSessionButton(
        offer: NewSessionOffer(presentation: .preview),
        spawn: {},
        isStarting: true,
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
