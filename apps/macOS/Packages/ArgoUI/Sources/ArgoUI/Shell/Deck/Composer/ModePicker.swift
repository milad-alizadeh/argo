import SwiftUI

/// The `Read Only · Plan · Code · Auto` stance, as the stock menu picker, because the platform's
/// own picker is the one macOS users already know how to read and drive.
///
/// A menu rather than segments (design decision 1): four rungs of segments ate the footer's width
/// and pushed the run facts off the row entirely at the composer's narrow sizes. The menu carries
/// no tint — macOS draws it through `NSPopUpButton`, which ignores both `.tint` and
/// `.foregroundStyle`, so a rung is read from its word alone.
struct ModePicker: View {
    @Binding var mode: ComposerMode

    var body: some View {
        Picker("Mode", selection: $mode) {
            ForEach(ComposerMode.allCases) { mode in
                Text(mode.rawValue).tag(mode)
            }
        }
        .pickerStyle(.menu)
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
