import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The ticket picker's query field, which is what the picker opens ON (#1231) — a real field
/// holding key focus from the first frame, so the reader types rather than reads.
///
/// It owns the keys as well as the characters, because the arrows and Return have to be taken
/// BEFORE the field's own handling of them: an up arrow left to a `TextField` walks the caret to
/// the head of the line rather than the cursor to the row above.
struct SessionTicketPickerField: View {
    /// What a key in this field asks the picker for. An enum and not four closures: the field
    /// takes one way of being answered, and a fifth key fails to compile at the switch that
    /// answers them rather than silently doing nothing.
    enum Key {
        case up
        case down
        case commit
        case dismiss
    }

    @Environment(\.argo) private var argo

    @Binding var query: String
    let press: (Key) -> Void

    /// Held here rather than passed in: the field is the only thing in the picker that can take
    /// focus, so nothing outside it has a second candidate to choose between.
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            ArgoGlyph(ArgoSymbol.searchBacklog, .inline)
                .foregroundStyle(argo.color.text.tertiary)
            field
        }
        .padding(.horizontal, ArgoSpacing.base)
        .frame(height: ArgoControlBox.vessel)
    }

    private var field: some View {
        TextField(Self.prompt, text: $query)
            .textFieldStyle(.plain)
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.primary)
            .focused($isFocused)
            .onKeyPress(.upArrow) { take(.up) }
            .onKeyPress(.downArrow) { take(.down) }
            .onKeyPress(.escape) { take(.dismiss) }
            .onSubmit { press(.commit) }
            .onAppear { isFocused = true }
            .accessibilityLabel(Self.prompt)
    }

    private func take(_ key: Key) -> KeyPress.Result {
        press(key)
        return .handled
    }

    /// Says what may be typed, because the two things that match are not the same kind of thing
    /// and a reader who only knows one of them types less than they could.
    static let prompt = "Search Tickets by number or title"
}
