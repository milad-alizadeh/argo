import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// A skill the Session was handed, drawn where it happened (#688).
///
/// A chip that hugs its own words, not a rule across the measure: the marks that run the column
/// say the reading changed SHAPE, and this one says something arrived inside it.
package struct SkillLoadedMarker: View {
    @Environment(\.argo) private var argo

    let skill: FeedSkillLoad
    /// Whether this row's evidence is what the panel is showing, as a call line takes it.
    let isOpen: Bool
    let open: () -> Void

    package var body: some View {
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
                .foregroundStyle(verdict ?? argo.color.text.disabled)
            Text(Self.label)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(verdict ?? argo.color.text.tertiary)
            // The label's own rung in the machine face, as every machine string the feed sets.
            Text(skill.load.name)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(verdict ?? argo.color.text.primary)
            disclosure
        }
        .lineLimit(1)
        .padding(.horizontal, ArgoSpacing.base)
        .padding(.vertical, ArgoSpacing.snug)
        .background(ground, in: .rect(cornerRadius: ArgoRadius.marker))
        // The chip's ground stands 14 levels off the deck's, which alone reads as a soft patch
        // rather than an object at this size.
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.marker)
                .strokeBorder(argo.color.edge.hairline, lineWidth: ArgoStroke.border)
        }
        .contentShape(.rect(cornerRadius: ArgoRadius.marker))
    }

    /// Drawn only where there is something to open, so the row never offers a click that does
    /// nothing.
    @ViewBuilder private var disclosure: some View {
        if skill.opened != nil {
            ArgoDisclosure(.beside)
                .foregroundStyle(isOpen ? argo.color.interaction.accent : argo.color.text.disabled)
        }
    }

    /// The failure ink where Argo could not read the file, `nil` everywhere else. Read off the
    /// load, which is also where the minimap reads it.
    private var verdict: ArgoColor? {
        skill.ink.state(in: argo.color)
    }

    private var ground: ArgoColor {
        isOpen ? argo.color.surface.selected : argo.color.surface.glassTint
    }

    /// Argo's own words about the record, so they are not the skill's to change.
    private static let label = "Skill Loaded:"

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(skill: FeedSkillLoad, isOpen: Bool, open: @escaping () -> Void) {
        self.skill = skill
        self.isOpen = isOpen
        self.open = open
    }
}

// The open row beside a closed one: the selected ground and the accent chevron are what say which
// marker the panel is showing, and neither is reachable without a click.
