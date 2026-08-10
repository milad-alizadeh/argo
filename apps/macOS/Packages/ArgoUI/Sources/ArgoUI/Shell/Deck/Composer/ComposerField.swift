import SwiftUI

/// The growing text view — the field the user speaks into.
///
/// Return submits and never inserts: at this field a newline SUBMITS a Turn, exactly as it does
/// at the CLI's own prompt, and the platform's Option-Return is what breaks a line. It grows with
/// content to the study's six-line ceiling and scrolls inside itself past it, so the feed above
/// is never squeezed.
struct ComposerField: View {
    @Environment(\.argo) private var argo

    @Binding var text: String
    let placeholder: String
    let submit: () -> Void

    var body: some View {
        TextField(
            "Message",
            text: $text,
            prompt: Text(placeholder).foregroundStyle(argo.color.text.disabled.color),
            axis: .vertical,
        )
        .textFieldStyle(.plain)
        .lineLimit(1 ... ArgoComposerVessel.fieldLineCeiling)
        .argoText(ArgoTypography.body)
        .foregroundStyle(argo.color.text.primary)
        .onSubmit(submit)
        .accessibilityLabel(placeholder)
    }
}

#Preview("Composer field — at rest and holding a draft") {
    VStack(alignment: .leading, spacing: ArgoSpacing.loose) {
        ComposerField(text: .constant(""), placeholder: "Message Claude Code…", submit: {})
        ComposerField(
            text: .constant("Fix the caption, not the sort: the sort is right."),
            placeholder: "Message Claude Code…",
            submit: {},
        )
    }
    .padding(ArgoSpacing.section)
    .frame(width: 520)
    .argoDeckSurface()
    .argoAppearance()
}
