import ArgoDesign
import ArgoEngine
import SwiftUI

/// The growing text view — the field the user speaks into.
///
/// Return SUBMITS a Turn, exactly as it does at the CLI's own prompt, and Shift-Return breaks the
/// line. Both need a caret, which is why the control underneath is an `NSTextView` and not a
/// `TextField` (#734): the stock field had no caret to break a line at, and drew the face's own
/// leading whatever the study asked for. It grows with content to the study's six-line ceiling and
/// scrolls inside itself past it, so the feed above is never squeezed.
///
/// The placeholder is drawn HERE rather than by the control: `placeholderString` belongs to
/// `NSTextField`, and a text view has none.
struct ComposerField: View {
    @Environment(\.argo) private var argo

    @Binding var text: String
    let placeholder: String
    let submit: () -> Void
    /// An arrow, offered to whichever composer menu is open. `false` leaves the key to the caret,
    /// so a line that opens no menu keeps the platform's own movement.
    var walk: (ComposerKeyIntent) -> Bool = { _ in false }
    /// Escape. `false` says there was no menu to put away, and the key goes on up the responder
    /// chain rather than being swallowed here.
    var dismiss: () -> Bool = { false }
    /// Tab, offered to whichever composer menu is open. `false` says no row was under a cursor to
    /// take, and the key stays the focus walk it has always been (#1181).
    var complete: () -> Bool = { false }
    /// What a paste was holding, where it was holding files or pixels rather than words (#540).
    var attach: ([SessionAttachment]) -> Void = { _ in }

    var body: some View {
        ComposerTextView(
            text: $text,
            placeholder: placeholder,
            submit: submit,
            walk: walk,
            dismiss: dismiss,
            complete: complete,
            attach: attach,
        )
        .frame(minHeight: ArgoComposerVessel.fieldLineHeight)
        .overlay(alignment: .topLeading) { prompt }
    }

    /// Drawn at the field's own face and rhythm, so the words the reader types land exactly where
    /// the placeholder stood.
    @ViewBuilder private var prompt: some View {
        if text.isEmpty {
            Text(placeholder)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.disabled)
                .frame(height: ArgoComposerVessel.fieldLineHeight)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
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
        ComposerField(
            text: .constant("Two lines now,\nthe second one made with Shift-Return."),
            placeholder: "Message Claude Code…",
            submit: {},
        )
    }
    .padding(ArgoSpacing.section)
    .frame(width: 520)
    .argoDeckSurface()
    .argoAppearance()
}
