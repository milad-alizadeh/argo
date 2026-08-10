import SwiftUI

/// The `Ask · Plan · Code` stance, as the stock segmented control — restyled through nothing,
/// because the platform's own picker is the one macOS users already know how to read and drive.
struct ModePicker: View {
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
    }
}

#Preview("Mode picker") {
    ModePicker(mode: .constant(.code))
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}
