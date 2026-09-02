import ArgoDesign
import SwiftUI

/// The tab line's trailing group (`docs/designs/cockpit-session-header.md`): what the Session is
/// waiting for, the one instrument, and the remedy when there is one.
package struct TabLineInstruments: View {
    @Environment(\.argo) private var argo

    /// Absent when nothing is selected, and the group draws nothing.
    let header: SessionHeaderProjection.Header?
    /// `async` because `/handoff` is answered in minutes, so the control holds itself that long.
    var handOff: () async -> Void = {}

    package var body: some View {
        // The instrument is a bar with no baseline of its own.
        HStack(alignment: .center, spacing: ArgoSpacing.loose) {
            if let header {
                if let state = header.state {
                    stateWord(state)
                }
                SessionHeaderContext(context: header.context, facts: header.facts)
                // LAST: the design puts the remedy on the trailing edge, ahead of the instrument.
                if let handoff = header.handoff {
                    SessionHandoffButton(handoff: handoff, run: handOff)
                }
            }
        }
        .accessibilityElement(children: .contain)
    }

    /// Its own element, so a screen reader hears it apart from the title in the titlebar.
    private func stateWord(_ state: SessionState.Reading) -> some View {
        Text(state.word)
            .argoText(ArgoTypography.rowMeta)
            .foregroundStyle(state.tone?.tint(in: argo.color) ?? argo.color.text.tertiary)
            .lineLimit(1)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        header: SessionHeaderProjection.Header?,
        handOff: @escaping () async -> Void = {},
    ) {
        self.header = header
        self.handOff = handOff
    }
}
