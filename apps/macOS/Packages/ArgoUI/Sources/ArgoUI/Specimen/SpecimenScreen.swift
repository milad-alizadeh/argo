import SwiftUI

/// One catalog entry filling the window. No per-case frame: a state is judged at the width the app
/// actually gives it.
public struct SpecimenScreen: View {
    /// Read by the case helpers in `SpecimenScreen+Cases.swift`, which key their fixtures off it,
    /// and by the catalog switch in `SpecimenScreen+Content.swift`.
    let specimen: Specimen

    public init(specimen: Specimen) {
        self.specimen = specimen
    }

    public var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .argoAppearance()
    }
}
