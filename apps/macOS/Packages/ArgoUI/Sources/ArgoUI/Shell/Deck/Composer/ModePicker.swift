import SwiftUI

/// The `Read Only · Plan · Code · Auto` stance, as the stock menu picker.
///
/// The menu carries no tint and no per-row caption: macOS draws it through `NSPopUpButton`, whose
/// rows take a title and nothing else, and which ignores `.tint` and `.foregroundStyle` alike. So
/// a rung is a word on the footer, and its boundary is on hover.
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
        .help("\(mode.rawValue) — \(mode.boundary)")
    }
}

#Preview("Mode picker") {
    ModePicker(mode: .constant(.code))
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}
