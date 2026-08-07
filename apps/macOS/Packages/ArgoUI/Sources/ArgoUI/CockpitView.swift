import SwiftUI

/// The window's content. Until the native shell lands (#376) it renders the visual
/// foundation on the surfaces the shell will occupy — the contract is only judgeable at
/// window size, and a preview canvas is not where a Liquid Glass sidebar proves itself.
public struct CockpitView: View {
    public init() {}

    public var body: some View {
        FoundationSpecimen()
            .frame(minWidth: 960, minHeight: 600)
    }
}

#Preview("Cockpit window") {
    CockpitView()
        .frame(width: 1280, height: 800)
}
