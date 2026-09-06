import ArgoAtoms
import ArgoDesign
import SwiftUI

/// A search mark and a real field beside it, at the height every container on a control band
/// stands at (#1242, #1231) — the line both of this app's search fields are built from.
///
/// One molecule and not two: the backlog's field wraps it in a floating capsule at a measured
/// width, and the ticket picker's stands it bare over a popover with the keys wired up. What is
/// the same in both is what lives here.
///
/// It owns the keys as well as the characters, because a picker's arrows and Return have to be
/// taken BEFORE the field's own handling of them: an up arrow left to a `TextField` walks the
/// caret to the head of the line rather than a cursor to the row above.
package struct SearchFieldLine: View {
    /// What a key in this field asks its picker for. An enum and not four closures: the field
    /// takes one way of being answered, and a fifth key fails to compile at the switch that
    /// answers them rather than silently doing nothing.
    package enum Key {
        case up
        case down
        case commit
        case dismiss
    }

    @Environment(\.argo) private var argo

    @Binding var query: String
    /// Says what may be typed. It is the accessibility label too — a placeholder a screen reader
    /// cannot reach is half a label.
    let prompt: String
    /// Whether the field takes key focus as it appears. `true` only where the surface was opened
    /// for typing: a field that grabbed focus on a band nobody pressed would steal the keyboard.
    let opensFocused: Bool
    let press: (Key) -> Void

    @FocusState private var isFocused: Bool

    package init(
        query: Binding<String>,
        prompt: String,
        opensFocused: Bool = false,
        press: @escaping (Key) -> Void = { _ in },
    ) {
        _query = query
        self.prompt = prompt
        self.opensFocused = opensFocused
        self.press = press
    }

    package var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            ArgoGlyph(ArgoSymbol.searchBacklog, .inline)
                .foregroundStyle(argo.color.text.tertiary)
            field
        }
        .padding(.horizontal, ArgoSpacing.base)
        .frame(height: ArgoControlBox.vessel)
    }

    private var field: some View {
        TextField(prompt, text: $query)
            .textFieldStyle(.plain)
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.primary)
            .focused($isFocused)
            .onKeyPress(.upArrow) { take(.up) }
            .onKeyPress(.downArrow) { take(.down) }
            .onKeyPress(.escape) { take(.dismiss) }
            .onSubmit { press(.commit) }
            .onAppear { isFocused = opensFocused }
            .accessibilityLabel(prompt)
            .overlay(alignment: .leading) { placeholder }
    }

    /// Drawn HERE rather than handed to the field, exactly as `ComposerField` draws its own: a
    /// `prompt:` reaches AppKit as a string and comes back in the platform's placeholder colour,
    /// which was the one ink on this line outside the palette (#1250). Measured on the render —
    /// the `prompt:` overload was tried first and drew 143 where the rung is 153.
    @ViewBuilder private var placeholder: some View {
        if query.isEmpty {
            Text(prompt)
                .argoLine(ArgoTypography.body, .metadata)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }

    private func take(_ key: Key) -> KeyPress.Result {
        press(key)
        return .handled
    }
}
