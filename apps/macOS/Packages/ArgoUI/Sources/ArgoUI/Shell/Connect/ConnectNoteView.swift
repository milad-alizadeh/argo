import SwiftUI

/// Something that did not work, in the three parts it happened in: what, why, and what to do.
///
/// Three lines rather than a paragraph, because the reader is looking for the third one. The panel
/// stays live underneath it and the note takes no control of its own: there is nothing to dismiss,
/// since acting again is what replaces it.
struct ConnectNoteView: View {
    @Environment(\.argo) private var argo

    let note: ConnectNote

    var body: some View {
        HStack(alignment: .top, spacing: ArgoSpacing.base) {
            ArgoGlyph(ArgoSymbol.refused, .inline)
                .foregroundStyle(ArgoOperationalState.failure.tint(in: argo.color))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                lines
                // Below the fix rather than beside the cause: the three lines are what the reader
                // is scanning, and a control between them would come before the remedy it is
                // quieter than. Absent where Argo wrote the middle line itself (§5).
                if let output = note.output {
                    RawOutputDisclosure(output: output)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: ArgoSpacing.flush)
        }
        .padding(ArgoSpacing.comfortable)
        .background {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .fill(ArgoOperationalState.failure.ground(in: argo.color))
        }
        // `contain` and not `combine`: a combined note swallows the gesture beside it, and an
        // output nobody can reach is the thing §5 exists to stop.
        .accessibilityElement(children: .contain)
    }

    /// The three parts, spoken as the one sentence they are.
    private var lines: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
            Text(note.what)
                .argoText(ArgoTypography.rowTitle)
                .foregroundStyle(argo.color.text.primary)
            Text(note.why)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.secondary)
            Text(note.fix)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.primary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(note.spoken)
    }
}

#Preview("Connect note — a bind the provider refused") {
    Form {
        Section {
            ConnectNoteView(note: ConnectNote(refusal: .scopeNotVisible("milad-alizadeh/argo")))
        }
    }
    .formStyle(.grouped)
    .frame(width: ArgoConnectPanel.width)
    .argoAppearance()
}

// The other shape the same value takes: a provider's own sentence in the middle line, which is
// usually the only thing that says how to fix it.
#Preview("Connect note — the provider's own words") {
    ConnectNoteView(note: ConnectNote(
        deviceFlow: .refused(
            code: "access_denied",
            description: "Your organisation blocks OAuth Apps that request repo access.",
        ),
        provider: .github,
    ))
    .frame(width: ArgoConnectPanel.width)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
