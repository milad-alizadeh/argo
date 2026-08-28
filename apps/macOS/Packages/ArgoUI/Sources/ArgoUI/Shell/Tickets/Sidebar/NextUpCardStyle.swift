import SwiftUI

/// The Next-up hero AS a control (#898): the card's own ground, washed under the pointer and
/// pressed under the click.
///
/// A style and not `.plain`: `.plain` leaves the card reading exactly as it did before — a border
/// and a raised ground that answer nothing — and the report is that it looks like a control and is
/// not one. What it draws instead is the hover-then-pressed pair every other row already uses.
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

    /// A nested `View` and not the chain in `makeBody`: hover is state, and a `ButtonStyle` holds
    /// none of its own.
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
                .pointerStyle(.link)
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
    /// The card's pointer state, forced for a RENDER. Hover and press are live input, so a
    /// specimen has no other way to put either on a screenshot — the same reason
    /// `argoStillsMotion` exists.
    ///
    /// Nothing outside `Specimen/` writes it, and unset is the shipping path.
    @Entry var nextUpStillsPointer: NextUpCardStyle.Pointer?
}
