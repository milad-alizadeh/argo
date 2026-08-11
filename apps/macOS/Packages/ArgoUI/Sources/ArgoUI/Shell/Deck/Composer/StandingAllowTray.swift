import ArgoEngine
import SwiftUI

/// What this Session has stopped asking about, at the top of the vessel — the record half of #572.
///
/// It rides above the field, in the slot the design gives `AttachmentTray`, because that is the
/// surface the reader is in front of on every turn: a standing decision has to be findable without
/// being looked for, and the composer is the one place a user of a Session always ends up.
///
/// Drawn on the prompt as well as on the composer at rest. The prompt is where a grant gets made,
/// and a reader deciding on the next tool should be able to see what they already blessed.
struct StandingAllowTray: View {
    @Environment(\.argo) private var argo

    let allows: [StandingAllow]
    /// Take one back, by tool. A closure and not a driver, so the vessel renders from a preview or
    /// a specimen with nothing behind it.
    let revoke: (String) -> Void

    /// Wrapped rather than run along one line, because every chip has to stay reachable: a grant
    /// pushed past the vessel's edge is one the user cannot find or take back, which is the state
    /// #572 exists to end. The label is the first item in the flow, so it breaks with them.
    var body: some View {
        WrapFlow(gap: ArgoSpacing.tight) {
            Text(StandingAllowProjection.trayLabel)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.tertiary)
                // The label rides the chips' own height, so a line holding both sits on one
                // baseline rather than seating the text at the top of the tallest chip.
                .frame(height: ArgoComposerVessel.chipHeight)
            ForEach(allows) { allow in
                StandingAllowChip(toolName: allow.toolName) { revoke(allow.toolName) }
            }
        }
        .padding(.bottom, ArgoSpacing.snug)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(StandingAllowProjection.trayLabel)
    }
}

/// One granted tool, in the chip shape the design froze for an attachment: radius `control`, the
/// name, and an `×` that undoes it.
///
/// The `×` is the point of the chip. A grant that can only be undone by ending the Session is not
/// a decision a person can make carefully, so the way back sits ON the record of it rather than
/// behind a menu somewhere else.
private struct StandingAllowChip: View {
    @Environment(\.argo) private var argo

    let toolName: String
    let revoke: () -> Void

    var body: some View {
        HStack(spacing: ArgoSpacing.tight) {
            Text(toolName)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.secondary)
                // Truncated in the MIDDLE, and only here: an MCP tool is named
                // `mcp__server__the_actual_verb`, so a tail ellipsis leaves a row of chips that
                // all read `mcp__claude-in-…`. The two informative ends survive, and the `help`
                // and accessibility label below both carry the name in full.
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: ArgoComposerVessel.chipNameCeiling, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            Button(action: revoke) {
                ArgoGlyph(ArgoSymbol.dismiss, .inline)
                    .foregroundStyle(argo.color.text.tertiary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(StandingAllowProjection.revocation(toolName))
            .help(StandingAllowProjection.revocation(toolName))
        }
        .padding(.horizontal, ArgoSpacing.snug)
        .frame(height: ArgoComposerVessel.chipHeight)
        .background(argo.color.surface.control, in: .rect(cornerRadius: ArgoRadius.control))
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .strokeBorder(argo.color.edge.subtle, lineWidth: ArgoStroke.hairline)
        }
    }
}

#Preview("Standing allows — one tool") {
    StandingAllowTray(allows: [StandingAllow(toolName: "Bash")], revoke: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 640)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Standing allows — several") {
    StandingAllowTray(
        allows: ["Bash", "Edit", "WebFetch"].map(StandingAllow.init(toolName:)),
        revoke: { _ in },
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Standing allows — more than one line of them") {
    StandingAllowTray(
        allows: [
            "Bash", "Edit", "Write", "Read", "Grep", "Glob", "WebFetch", "WebSearch",
            "NotebookEdit", "TodoWrite",
        ].map(StandingAllow.init(toolName:)),
        revoke: { _ in },
    )
    .padding(ArgoSpacing.section)
    .frame(width: 480)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Standing allows — a narrow vessel and a long tool name") {
    StandingAllowTray(
        allows: ["mcp__claude-in-chrome__read_console_messages", "Bash"]
            .map(StandingAllow.init(toolName:)),
        revoke: { _ in },
    )
    .padding(ArgoSpacing.section)
    .frame(width: 360)
    .argoDeckSurface()
    .argoAppearance()
}
