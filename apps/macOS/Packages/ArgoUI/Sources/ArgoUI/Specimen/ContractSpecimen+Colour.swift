import SwiftUI

/// The palette half of the contract sheet: every colour role, on the surfaces it is read
/// against.
///
/// Split from the type and motion half because it is the half that grows — a role group gains a
/// member and this file gains a swatch, while the type ladder is Apple's and does not move.
extension ContractSpecimen {
    var surfaces: some View {
        section("Surfaces — near-black graphite, depth from tone and edge") {
            VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
                HStack(spacing: ArgoSpacing.flush) {
                    ForEach(
                        Array(argo.color.surface.ramp.enumerated()),
                        id: \.offset,
                    ) { _, tone in
                        Rectangle().fill(tone).frame(height: 56)
                    }
                }
                .overlay {
                    Rectangle()
                        .strokeBorder(argo.color.edge.hairline, lineWidth: ArgoStroke.hairline)
                }
                // Each on BOTH grounds: half of these are translucent, and a translucent role
                // judged over one backdrop is a role half-judged.
                swatches(argo.color.surface.all, over: [
                    ("on base", argo.color.surface.base),
                    ("on raised", argo.color.surface.raised),
                ])
            }
        }
    }

    /// Every text rung shown as INK, which is the only way a text role can be judged — a chip of
    /// the colour says nothing about whether it is readable at 13pt.
    var text: some View {
        section("Text — every rung is neutral; a marked span takes a ground, not a hue") {
            VStack(alignment: .leading, spacing: ArgoSpacing.snug) {
                ForEach(argo.color.text.all, id: \.name) { role in
                    HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
                        label(role.name)
                        Text("The record of a Session")
                            .argoText(ArgoTypography.body)
                            .foregroundStyle(role.color)
                            .padding(.horizontal, ArgoSpacing.snug)
                            .background(
                                role.name == "onAccent" ? argo.color.interaction.accent
                                    : ArgoColor.transparent,
                            )
                    }
                }
                markedSpans
            }
        }
    }

    /// The marked span on both grounds it is read on, in both voices it is read in — the four
    /// cases the contrast floor is asserted for, shown rather than only measured.
    var markedSpans: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.snug) {
            ForEach(
                [("on base", argo.color.surface.base), ("on raised", argo.color.surface.raised)],
                id: \.0,
            ) { ground in
                HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
                    label("marked · \(ground.0)")
                    ForEach(
                        [
                            ("message", argo.color.text.primary),
                            ("thought", argo.color.text.tertiary),
                        ],
                        id: \.0,
                    ) { voice in
                        FeedProseText(text: "the `ArgoPalette` ramp")
                            .environment(\.proseVoice, voice.1)
                            .foregroundStyle(voice.1)
                    }
                }
                .padding(ArgoSpacing.snug)
                .background(ground.1)
            }
        }
    }

    var edges: some View {
        section("Edges — the primary depth device, every one of them translucent") {
            HStack(spacing: ArgoSpacing.comfortable) {
                ForEach(argo.color.edge.all, id: \.name) { role in
                    VStack(spacing: ArgoSpacing.tight) {
                        RoundedRectangle(cornerRadius: ArgoRadius.control)
                            .strokeBorder(role.color, lineWidth: ArgoStroke.border)
                            .frame(width: 96, height: 40)
                        Text(role.name)
                            .argoText(ArgoTypography.machineCaption)
                            .foregroundStyle(argo.color.text.tertiary)
                    }
                }
            }
        }
    }

    var diff: some View {
        section("Diff — its own pair of inks, held off every operational state") {
            HStack(spacing: ArgoSpacing.loose) {
                ForEach(argo.color.diff.all, id: \.name) { role in
                    HStack(spacing: ArgoSpacing.snug) {
                        Text(role.name == "added" ? "+8" : "−3")
                            .argoText(ArgoTypography.machineEmphasis)
                            .foregroundStyle(role.color)
                        Text("let ramp = neutral")
                            .argoText(ArgoTypography.machine)
                            .foregroundStyle(argo.color.text.secondary)
                            .padding(.horizontal, ArgoSpacing.snug)
                            .background(argo.color.diff.wash(role.color))
                    }
                }
            }
        }
    }

    /// Not this palette's, and shown so the exemption is visible rather than a comment nobody
    /// opens: source is read in Xcode's own dark theme, because the reader has the same files open
    /// in Xcode all day. It is the one place a hue outside the contract is correct.
    var syntax: some View {
        section("Not from this palette — source keeps Xcode's theme (evidence panel only)") {
            Text("SyntaxTheme.colors = .dark(.xcode)")
                .argoText(ArgoTypography.machine)
                .foregroundStyle(argo.color.text.secondary)
                .padding(ArgoSpacing.snug)
                .background(argo.color.surface.raised, in: .rect(cornerRadius: ArgoRadius.control))
        }
    }

    func swatches(
        _ roles: [(name: String, color: ArgoColor)],
        over grounds: [(String, ArgoColor)],
    )
        -> some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            ForEach(grounds, id: \.0) { ground in
                HStack(spacing: ArgoSpacing.tight) {
                    label(ground.0)
                    ForEach(roles, id: \.name) { role in
                        VStack(spacing: ArgoSpacing.tight) {
                            Rectangle()
                                .fill(role.color)
                                .frame(width: 68, height: 32)
                                .background(ground.1)
                                .overlay {
                                    Rectangle().strokeBorder(
                                        argo.color.edge.hairline,
                                        lineWidth: ArgoStroke.hairline,
                                    )
                                }
                            Text(role.name)
                                .argoText(ArgoTypography.machineCaption)
                                .foregroundStyle(argo.color.text.tertiary)
                        }
                    }
                }
            }
        }
    }
}
