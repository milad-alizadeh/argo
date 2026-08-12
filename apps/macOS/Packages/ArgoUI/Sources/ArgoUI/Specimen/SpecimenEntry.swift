import SwiftUI

/// One renderable state: the name the harness passes, and what that name draws, as ONE value.
///
/// An entry cannot be half-written — there is no name without a rendering, and no rendering
/// nothing can address (#637).
public struct SpecimenEntry {
    /// What `--specimen` is given and what the PNG is named. Unique across the registry, which
    /// `SpecimenRegistryTests` checks.
    let name: String

    /// Erased, because the registry is one list of states drawn by unrelated views. Built on
    /// demand rather than stored: one launch draws one entry, so holding them all would run every
    /// fixture in the catalog to render one of them.
    let content: @MainActor () -> AnyView

    init(
        _ name: String,
        @ViewBuilder content: @escaping @MainActor () -> some View,
    ) {
        self.name = name
        self.content = { AnyView(content()) }
    }
}
