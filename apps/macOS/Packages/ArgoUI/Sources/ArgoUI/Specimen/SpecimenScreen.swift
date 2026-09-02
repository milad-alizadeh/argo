import ArgoDesign
import SwiftUI

/// One registry entry filling the window. No per-entry frame: a state is judged at the width the
/// app actually gives it.
public struct SpecimenScreen: View {
    let entry: SpecimenEntry

    public init(entry: SpecimenEntry) {
        self.entry = entry
    }

    public var body: some View {
        entry.content()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .argoAppearance()
    }
}
