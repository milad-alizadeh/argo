import ArgoEngine
import SwiftUI

/// The Mode a Session would start in — `Read Only · Plan · Code · Auto`, in ladder order, each rung
/// named by the boundary it will not cross unasked (ADR-0025, `CONTEXT.md` L2 · Autonomy).
///
/// The rows carry no MARK, unlike the composer's: `Auto`'s mark is `ArgoSymbol.modeAuto`, the same
/// bolt `StartControl`'s own verb wears directly above it.
struct ModeMenu: View {
    @Environment(\.argo) private var argo

    @Binding var mode: SessionMode

    var body: some View {
        Menu {
            Picker("Start in", selection: $mode) {
                ForEach(SessionMode.allCases, id: \.self) { rung in
                    Text(Self.rung(rung)).tag(rung)
                }
            }
            .pickerStyle(.inline)
        } label: {
            ArgoGlyph(ArgoSymbol.disclosure, .chevron)
                .foregroundStyle(argo.color.text.tertiary)
                .rotationEffect(.degrees(90))
                .frame(
                    width: ArgoWorkChrome.iconButtonWidth,
                    height: ArgoWorkChrome.iconButtonHeight,
                )
                .contentShape(.capsule)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .fixedSize()
        .help("Choose the Mode to start in — \(Self.rung(mode))")
        .accessibilityLabel("Start in, \(Self.rung(mode))")
    }

    /// The rung and where it stops, in one string. A native menu row is one line of text, so the
    /// study's two-column layout — the word, its boundary set right in the machine caption — is not
    /// reachable through `Picker`; the em dash carries the same pair. The words are
    /// `SessionMode.boundary`'s, reused rather than rephrased: the composer already names these
    /// four boundaries, and one fact said two ways is one of them waiting to go stale.
    private static func rung(_ mode: SessionMode) -> String {
        "\(mode.label) — \(mode.boundary)"
    }
}

#Preview("Mode menu") {
    @Previewable @State var mode = SessionMode.code

    ToolbarVessel {
        ModeMenu(mode: $mode)
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
