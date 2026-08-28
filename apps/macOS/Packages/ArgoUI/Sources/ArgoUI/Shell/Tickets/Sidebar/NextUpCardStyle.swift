import SwiftUI

/// The Next-up hero AS a control (#898): its own ground, washed under the pointer and pressed under
/// the click. `.plain` draws neither, which is the reading the report was about.
struct NextUpCardStyle: ButtonStyle {
    /// Where the pointer is, which is the whole of what the card's ground says.
    enum Pointer: CaseIterable, Hashable {
        case away
        case over
        case down
    }

    func makeBody(configuration: Configuration) -> some View {
        Card(isPressed: configuration.isPressed, label: configuration.label)
    }

    /// A nested `View`, because a `ButtonStyle` holds no `@State` and hover is state.
    private struct Card: View {
        @Environment(\.nextUpStillsPointer) private var still

        let isPressed: Bool
        let label: ButtonStyleConfiguration.Label

        @State private var isHovered = false

        var body: some View {
            label
                .nextUpCardGround(still ?? pointer)
                // The card and not the words in it: a hero whose hit area was its title would be a
                // target to aim at, on a rail that is mostly card.
                .contentShape(.rect(cornerRadius: ArgoRadius.control))
                .onHover { isHovered = $0 }
        }

        /// Pressed outranks hover, because the pointer is over the card for the whole of a click.
        private var pointer: NextUpCardStyle.Pointer {
            if isPressed {
                return .down
            }
            return isHovered ? .over : .away
        }
    }
}

extension EnvironmentValues {
    /// The card's pointer state, forced for a RENDER. Hover and press are live input, so a specimen
    /// has no other way to put either on a screenshot — the reason `argoStillsMotion` exists.
    @Entry var nextUpStillsPointer: NextUpCardStyle.Pointer?
}
