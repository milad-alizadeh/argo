import ArgoEngine
import SwiftUI

/// A skill the Session was handed, drawn where it happened (#688).
///
/// A chip rather than a rule across the measure: the marks that run the column say the reading
/// changed SHAPE, and this one says something arrived inside it. It hugs its own words for the same
/// reason — the user's line above it is theirs, and a band the width of the column beneath it would
/// read as a second thing they said.
struct SkillLoadedMarker: View {
    @Environment(\.argo) private var argo

    let skill: FeedSkillLoad
    /// Whether this row's evidence is what the panel is showing, as a call line takes it.
    let isOpen: Bool
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            chip
        }
        .buttonStyle(.plain)
        .disabled(skill.opened == nil)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(skill.spoken)
        .accessibilityHint(skill.opened == nil ? "" : "Opens the skill Argo read")
    }

    private var chip: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.callGap) {
            ArgoGlyph(ArgoSymbol.skill, .inline)
                .foregroundStyle(argo.color.text.disabled)
            Text(Self.label)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(verdict ?? argo.color.text.tertiary)
            Text(skill.load.name)
                .argoText(ArgoTypography.machine)
                .foregroundStyle(verdict ?? argo.color.text.primary)
            disclosure
        }
        .lineLimit(1)
        .padding(.horizontal, ArgoSpacing.base)
        .padding(.vertical, ArgoSpacing.snug)
        .background(ground, in: .rect(cornerRadius: ArgoRadius.marker))
        // The rim is what makes the chip an object rather than a smudge: its ground stands 14
        // levels off the deck's, which on its own reads as a soft patch at any real brightness.
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.marker)
                .strokeBorder(argo.color.edge.hairline, lineWidth: ArgoStroke.border)
        }
        .contentShape(.rect(cornerRadius: ArgoRadius.marker))
    }

    /// Only where there is something to open. A marker with nothing behind it draws no chevron, so
    /// the row never offers a click that does nothing.
    @ViewBuilder private var disclosure: some View {
        if skill.opened != nil {
            ArgoDisclosure(.beside)
                .foregroundStyle(isOpen ? argo.color.interaction.accent : argo.color.text.disabled)
        }
    }

    /// The ink a file Argo could not read takes, and `nil` for the one it did — a failure is the
    /// only outcome in this feed with a colour. Read off the load, which is also where the minimap
    /// reads it.
    private var verdict: ArgoColor? {
        skill.ink.state(in: argo.color)
    }

    /// The chip's own ground, one step up from the deck. The open row keeps the selected ground
    /// every other opening row takes, so a panel full of text still says which line it came from.
    private var ground: ArgoColor {
        isOpen ? argo.color.surface.selected : argo.color.surface.glassTint
    }

    /// Argo's own words about the record, so they are not the skill's to change.
    private static let label = "Skill Loaded:"
}

#Preview("Skill loaded — read, unreadable, and nothing behind it") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
        ForEach(Array(FeedProjection.previewSkillLoads.enumerated()), id: \.offset) { _, skill in
            SkillLoadedMarker(skill: skill, isOpen: false, open: {})
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}
