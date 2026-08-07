import SwiftUI

/// The global primary checkout, kept separate from the selected Session's branch fact.
struct GitVessel: View {
    let checkout: CockpitPresentation.Checkout
    let refresh: () -> Void

    var body: some View {
        Menu {
            Button("Refresh checkout", action: refresh)
                .keyboardShortcut("r", modifiers: [.command, .shift])
        } label: {
            Label {
                Text(label)
                    .argoText(ArgoTypography.machineEmphasis)
                    .lineLimit(1)
                    .truncationMode(.middle)
            } icon: {
                Image(systemName: "arrow.trianglehead.branch")
            }
                .labelStyle(.titleAndIcon)
                .frame(maxWidth: ArgoLayout.gitVesselMaximumWidth)
        }
        .help("Global checkout — \(label)")
        .accessibilityLabel("Global checkout, \(accessibilityValue)")
        .glassEffect(.regular.interactive(), in: Capsule())
    }

    private var label: String {
        switch checkout {
        case let .branch(branch): branch
        case let .detached(shortSHA): "HEAD · \(shortSHA)"
        case .unavailable: "HEAD"
        }
    }

    private var accessibilityValue: String {
        switch checkout {
        case let .branch(branch): "branch \(branch)"
        case let .detached(shortSHA): "detached HEAD \(shortSHA)"
        case .unavailable: "HEAD unavailable"
        }
    }
}

#Preview("Git vessel") {
    GitVessel(checkout: .branch("main"), refresh: {})
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
