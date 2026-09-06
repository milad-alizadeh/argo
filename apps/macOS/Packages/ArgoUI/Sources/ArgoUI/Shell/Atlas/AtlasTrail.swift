import ArgoAtoms
import ArgoDesign
import AtlasLayout
import SwiftUI

/// Where the reader is, and every way back out of it (#1156, the approved design's `AtlasTrail`).
///
/// **The trail is the way back, and the button is the trail read one step at a time.** The design
/// draws both and they are not two answers: every crumb goes to the level it names, however many
/// levels up that is, and the button goes up exactly one — which is the step a reader who drilled
/// in by accident is looking for, and the one thing the ticket asks be a CONTROL rather than a
/// gesture to be guessed at.
///
/// It stands in the rail rather than over the map for `AtlasRoomRail`'s reason: the map package
/// draws the map, and where a strip stands in a window is the room's. It is between the find field
/// and the list because that is the order it is read in — what you asked, where you are, what is
/// there.
struct AtlasTrail: View {
    @Environment(\.argo) private var argo

    let descent: AtlasDescent

    /// The crumb under the pointer, by path. A crumb carries no resting ground — the design gives
    /// it none, so the level you are ON can be the only thing in the strip with weight — which
    /// leaves hover the whole of what says a crumb is a control at all.
    @State private var hovered: String?
    @State private var isOverBack = false
    @FocusState private var focused: String?
    @FocusState private var isBackFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            if let up = descent.up {
                back(to: up)
                    .padding(.bottom, ArgoSpacing.base)
            }
            crumbs
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, ArgoSpacing.loose)
        .padding(.vertical, ArgoSpacing.comfortable)
        // The band's own edge against the list under it. A hairline is the contract's answer to two
        // surfaces of one tone; these are two regions of one surface, which is what this rung is
        // for — the same edge the design draws under `#ctx`.
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(argo.color.edge.subtle)
                .frame(height: ArgoStroke.border)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Self.label)
    }

    /// What the strip is, said once for a reader who cannot see that it is a path.
    private static let label = "Where you are"

    /// The folders above the one you are in, each a control, and the one you are in, which is not.
    ///
    /// Wrapped rather than scrolled or elided: a trail is an address, and a path deep in a monorepo
    /// is long — a sideways scroller would hide the levels a reader most wants (the ones nearest
    /// the root, which are the way out), and an ellipsis in the middle would hide them too.
    private var crumbs: some View {
        WrapFlow(gap: ArgoSpacing.flush) {
            ForEach(Array(descent.trail.enumerated()), id: \.element.path) { step in
                if step.offset == descent.trail.count - 1 {
                    here(step.element)
                } else {
                    crumb(step.element)
                    separator
                }
            }
        }
        // The crumbs carry their own ground, so their text starts a padding in from the region's
        // edge. Pulled back by exactly that, so the first crumb's WORDS line up with the find field
        // above and the rows below rather than its invisible target does.
        .padding(.horizontal, -ArgoSpacing.snug)
    }

    private func crumb(_ step: AtlasStep) -> some View {
        Button { descent.enter(step.path) } label: {
            Text(step.name)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(ink(of: step))
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: Self.crumbWidth, alignment: .leading)
                .padding(.horizontal, ArgoSpacing.snug)
                .padding(.vertical, ArgoSpacing.hair)
                .background(ground(of: step), in: Self.shape)
                .argoFocusRing(focused == step.path, in: Self.shape)
                .contentShape(Self.shape)
        }
        .buttonStyle(.plain)
        .focusable()
        .focused($focused, equals: step.path)
        .onHover { hovered = $0 ? step.path : (hovered == step.path ? nil : hovered) }
        .help("Back to \(step.path)")
        .accessibilityLabel("Back to \(step.path)")
    }

    private func ink(of step: AtlasStep) -> Color {
        (hovered == step.path ? argo.color.text.primary : argo.color.text.secondary).color
    }

    private func ground(of step: AtlasStep) -> Color {
        hovered == step.path ? argo.color.interaction.accent(at: .muted).color : .clear
    }

    /// Where you are, which is not a link: the interface face rather than the machine one and a
    /// weight above the crumbs, because it is the subject of the column rather than a step to it.
    private func here(_ step: AtlasStep) -> some View {
        Text(step.name)
            .argoText(ArgoTypography.locationHeading)
            .foregroundStyle(argo.color.text.primary)
            .padding(.horizontal, ArgoSpacing.snug)
            .padding(.vertical, ArgoSpacing.hair)
            .accessibilityAddTraits(.isHeader)
    }

    private var separator: some View {
        Text(Self.chevron)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.disabled)
            .accessibilityHidden(true)
    }

    /// Up one level: the same move the crumb before the last one makes, in the place a reader looks
    /// for it. Quiet rather than accent-filled — going back is the ordinary thing to do here, and a
    /// filled button would be the loudest thing in a column of files.
    private func back(to path: String) -> some View {
        Button { descent.enter(path) } label: {
            Text("\(Self.backChevron) Back")
                .argoText(ArgoTypography.control)
                .foregroundStyle(argo.color.text.primary)
                .padding(.leading, ArgoSpacing.snug)
                .padding(.trailing, ArgoSpacing.base)
                .padding(.vertical, ArgoSpacing.tight)
                .background(backGround, in: Self.shape)
                .overlay { Self.shape.strokeBorder(backEdge, lineWidth: ArgoStroke.border) }
                .argoFocusRing(isBackFocused, in: Self.shape)
        }
        .buttonStyle(.plain)
        .focusable()
        .focused($isBackFocused)
        .onHover { isOverBack = $0 }
        // NO keyboard shortcut, and so no key drawn on it — the design puts a `⌫` here (`#ctx
        // .back kbd`), and Backspace is the one key this column cannot safely claim: the find field
        // stands directly above, and a plain-key shortcut is offered down the view tree ahead of
        // the first responder's own handling, so a reader deleting a typo could be thrown up a
        // level instead. A key drawn on a control that does not answer it is worse than no key, so
        // the glyph goes with it until something can bind the key only while the field has no
        // focus.
        .help("Back one level")
        .accessibilityLabel("Back one level")
    }

    private var backGround: Color {
        argo.color.interaction.accent(at: isOverBack ? .muted : .wash).color
    }

    private var backEdge: Color {
        isOverBack ? argo.color.interaction.accent.color : argo.color.edge.strong.color
    }

    /// What a crumb may take of the rail before it truncates — the design's own 190. A folder with
    /// a long name is clipped rather than allowed to push the levels after it onto a line of its
    /// own.
    private static let crumbWidth: CGFloat = 190
    private static let shape = RoundedRectangle(cornerRadius: ArgoRadius.control)
    private static let chevron = "\u{203a}"
    private static let backChevron = "\u{2039}"
}

private struct AtlasTrailPreview: View {
    @Environment(\.argo) private var argo

    let trail: [AtlasStep]

    var body: some View {
        AtlasTrail(descent: AtlasDescent(trail: trail) { _ in })
            .frame(width: AtlasRoomRail.width)
            .background(argo.color.surface.sunken.color)
            .argoAppearance()
    }
}

#Preview("Atlas trail — the whole repository") {
    AtlasTrailPreview(trail: [AtlasStep(path: "argo", name: "argo")])
}

#Preview("Atlas trail — two levels down") {
    AtlasTrailPreview(trail: [
        AtlasStep(path: "argo", name: "argo"),
        AtlasStep(path: "argo/apps", name: "apps"),
        AtlasStep(path: "argo/apps/macOS", name: "macOS"),
    ])
}

// The case the wrap is for: a path deep enough that the crumbs cannot stand on one line.
#Preview("Atlas trail — deep enough to wrap") {
    AtlasTrailPreview(trail: [
        AtlasStep(path: "argo", name: "argo"),
        AtlasStep(path: "argo/apps", name: "apps"),
        AtlasStep(path: "argo/apps/macOS", name: "macOS"),
        AtlasStep(path: "argo/apps/macOS/Packages", name: "Packages"),
        AtlasStep(path: "argo/apps/macOS/Packages/ArgoAtlas", name: "ArgoAtlas"),
        AtlasStep(path: "argo/apps/macOS/Packages/ArgoAtlas/Sources", name: "Sources"),
    ])
}
