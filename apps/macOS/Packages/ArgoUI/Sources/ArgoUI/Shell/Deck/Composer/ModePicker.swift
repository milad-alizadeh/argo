import SwiftUI

/// The `Ask · Plan · Code` stance, as the stock segmented control — restyled through nothing but
/// its tint, because the platform's own picker is the one macOS users already know how to read
/// and drive.
struct ModePicker: View {
    @Environment(\.argo) private var argo

    @Binding var mode: ComposerMode

    var body: some View {
        Picker("Mode", selection: $mode) {
            ForEach(ComposerMode.allCases) { mode in
                Text(mode.rawValue).tag(mode)
            }
        }
        .pickerStyle(.segmented)
        .controlSize(.small)
        .labelsHidden()
        .fixedSize()
        .tint(selectedInk)
    }

    /// What the selected segment is filled with. `Ask` takes the attention ink and `Plan` the
    /// accent — both departures from acting autonomously — and `Code` stays neutral (design
    /// decision 1): without this the window's own Ion Blue tint paints the DEFAULT stance as
    /// the loud one.
    private var selectedInk: Color {
        switch mode {
        case .ask: argo.color.state.attention.color
        case .plan: argo.color.interaction.accent.color
        case .code: argo.color.surface.selected.color
        }
    }
}

#Preview("Mode picker") {
    ModePicker(mode: .constant(.code))
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}
