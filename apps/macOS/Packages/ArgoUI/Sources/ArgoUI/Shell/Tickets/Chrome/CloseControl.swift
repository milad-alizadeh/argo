import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// The open ticket's closure verb, beside `StartControl` at the pane's leading edge (#1333).
///
/// **Absent, not inert, where the Binding does not declare `.closure`** (#872): a control that
/// offered a write the port refuses before the wire would take a press and do nothing — so a
/// `nil` `current` draws no control at all.
///
/// **One glyph carries both directions.** `current` decides which: the open ticket draws `close`'s
/// two reasons behind a menu, and a closed one draws `reopen` in their place — never both, because
/// nothing here can address a ticket that is simultaneously open and closed.
package struct CloseControl: View {
    @Environment(\.argo) private var argo
    let closure: TicketsChromeIntents.Verbs.Closure

    /// Spelled out because Swift synthesises no memberwise initializer above `internal`, and the
    /// specimens build this from their own target (#1085).
    package init(closure: TicketsChromeIntents.Verbs.Closure) {
        self.closure = closure
    }

    package var body: some View {
        // The group is drawn only where `current` answers at all: an empty capsule sitting beside
        // `StartControl` would be exactly the live-and-inert control #872 already ruled out, worn
        // as chrome instead of a press.
        if let current = closure.current {
            ArgoIconButtonGroup { content(current) }
                .disabled(!closure.control.isEnabled)
        }
    }

    @ViewBuilder private func content(_ current: TicketClosure) -> some View {
        if current == .open {
            closeMenu
        } else {
            reopenButton
        }
    }

    /// Two reasons, not a single `Close`: `TicketCloseReason` is `resolved` or `ruledOut`, and a
    /// button that always meant one of them would write a false fact every time the other was
    /// intended.
    private var closeMenu: some View {
        Menu {
            Button("Mark resolved") { closure.close(.resolved) }
            Button("Rule out") { closure.close(.ruledOut) }
        } label: {
            ArgoGlyph(ArgoSymbol.closeTicket, .control)
                .argoControlFace(ArgoControlFace(ink: argo.color.text.tertiary))
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .fixedSize()
        .help(help(open: true))
        .accessibilityLabel(help(open: true))
    }

    private var reopenButton: some View {
        ArgoIconButton(
            ArgoSymbol.reopenTicket,
            voice: ArgoControlVoice("Reopen", help: help(open: false)),
            face: ArgoControlFace(ink: argo.color.text.tertiary),
            act: closure.reopen,
        )
    }

    /// The provider's own words on a refusal (§4), and the plain verb otherwise — a tooltip rather
    /// than a line of its own: the band has no row beneath it to spend on one.
    private func help(open: Bool) -> String {
        closure.control.reason ?? (open ? "Close this ticket" : "Reopen this ticket")
    }
}

#Preview("Close control — open, resolved or ruled out") {
    CloseControl(closure: TicketsChromeIntents.Verbs.Closure(current: .open))
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("Close control — closed, offers reopen") {
    CloseControl(closure: TicketsChromeIntents.Verbs.Closure(current: .resolved))
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("Close control — pending") {
    CloseControl(closure: TicketsChromeIntents.Verbs.Closure(current: .open, control: .pending))
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("Close control — refused") {
    CloseControl(
        closure: TicketsChromeIntents.Verbs.Closure(
            current: .open,
            control: .refused(.refused("GitHub would not close this issue.")),
        ),
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Close control — not offered, draws nothing") {
    CloseControl(closure: TicketsChromeIntents.Verbs.Closure())
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
