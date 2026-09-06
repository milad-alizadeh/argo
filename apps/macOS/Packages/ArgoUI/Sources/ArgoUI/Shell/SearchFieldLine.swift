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
        /// `⌘⏎` — the backlog's ask (#1317). A key of its own and NOT a second reading of
        /// `commit`, because the whole decision the asking surface rests on is that the default
        /// never moves: `⏎` searches, and the surface that wants the other verb has to name it.
        case ask
    }

    /// What the field says it is — the words in it, and the mark beside them. One value, because
    /// the two are the same statement: a wand beside `Search the backlog` would be a field saying
    /// two things at once.
    package struct Look {
        /// Says what may be typed. It is the accessibility label too — a placeholder a screen
        /// reader cannot reach is half a label.
        let prompt: String
        /// Which mark the field wears. `.search` everywhere but the backlog's own field, which
        /// swaps it for the wand while it holds a question.
        var lead = Lead.search
    }

    /// The mark at the field's leading edge, and what it says. A named pair rather than a symbol
    /// and a Bool at the call site: the accent is not a decoration a caller chooses, it is what
    /// the wand means — the field is holding something the plain search cannot answer.
    package struct Lead {
        let symbol: String
        let accented: Bool

        /// A field looking for a substring, which is every field until one holds a question.
        package static let search = Lead(symbol: ArgoSymbol.searchBacklog, accented: false)
        /// The same field, once the text reads as a question (#1317).
        package static let ask = Lead(symbol: ArgoSymbol.askBacklog, accented: true)

        /// What the mark is drawn in. Asked of the LEAD rather than picked at the call site: the
        /// quiet mark takes the ink its kind already names (`.metadata`), so this adds no
        /// hand-picked rung, and the accent is the brand rather than a text rung at all.
        func ink(in palette: ArgoPalette) -> ArgoColor {
            palette.askMark(lit: accented)
        }
    }

    @Environment(\.argo) private var argo

    @Binding var query: String
    /// What the field says it is: the words in it, and the mark beside them.
    let look: Look
    /// Whether the field takes key focus as it appears. `true` only where the surface was opened
    /// for typing: a field that grabbed focus on a band nobody pressed would steal the keyboard.
    let opensFocused: Bool
    let press: (Key) -> Void

    @FocusState private var isFocused: Bool

    package init(
        query: Binding<String>,
        look: Look,
        opensFocused: Bool = false,
        press: @escaping (Key) -> Void = { _ in },
    ) {
        _query = query
        self.look = look
        self.opensFocused = opensFocused
        self.press = press
    }

    package var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            ArgoGlyph(look.lead.symbol, .inline)
                .foregroundStyle(look.lead.ink(in: argo.color))
            field
        }
        .padding(.horizontal, ArgoSpacing.base)
        .frame(height: ArgoControlBox.vessel)
    }

    private var field: some View {
        TextField(look.prompt, text: $query)
            .textFieldStyle(.plain)
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.primary)
            .focused($isFocused)
            .onKeyPress(.upArrow) { take(.up) }
            .onKeyPress(.downArrow) { take(.down) }
            .onKeyPress(.escape) { take(.dismiss) }
            // BEFORE `onSubmit`, which is what a bare Return reaches. AppKit hands the modified
            // Return here first, so the ask can be taken without the search running as well.
            .onKeyPress(.return, phases: .down) {
                $0.modifiers.contains(.command) ? take(.ask) : .ignored
            }
            .onSubmit { press(.commit) }
            .onAppear { isFocused = opensFocused }
            .accessibilityLabel(look.prompt)
            .overlay(alignment: .leading) { placeholder }
    }

    /// Drawn HERE rather than handed to the field, exactly as `ComposerField` draws its own: a
    /// `prompt:` reaches AppKit as a string and comes back in the platform's placeholder colour,
    /// which was the one ink on this line outside the palette (#1250). Measured on the render —
    /// the `prompt:` overload was tried first and drew 143 where the rung is 153.
    @ViewBuilder private var placeholder: some View {
        if query.isEmpty {
            Text(look.prompt)
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
