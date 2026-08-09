import SwiftUI

/// The contract's roles laid out side by side, for the one judgement the assembled cockpit
/// cannot give you: whether two states are still telling apart at a glance, and whether the
/// sans and the mono are still doing two different jobs.
///
/// **Every role in the palette appears here**, and `VisualContractTests` proves it by reflection —
/// a role that reaches the app without reaching this sheet is a colour nobody ever looked at,
/// which is exactly how a lavender `code` ink once got in and stayed. The swatches read their
/// names and values off the `all` arrays rather than repeating them, so adding a role adds a
/// swatch.
///
/// It renders whatever appearance is in the environment, so a second palette is judged by
/// pointing this at it — nothing here knows it is dark.
struct ContractSpecimen: View {
    @Environment(\.argo) var argo

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ArgoSpacing.section) {
                surfaces
                text
                edges
                states
                diff
                brand
                scale
                type
                icons
                shape
                depth
                motion
                syntax
            }
            .padding(ArgoSpacing.section)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .argoDeckSurface()
    }

    func label(_ name: String) -> some View {
        Text(name)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.tertiary)
            .frame(width: 132, alignment: .leading)
    }

    /// What a role is waiting on, when nothing draws it yet — drawn in the attention ink so an
    /// unjudged value cannot be mistaken for a settled one at a glance. This is the whole reason
    /// the `unwired` maps exist; a specimen that renders every role identically is a specimen that
    /// says every role has been looked at.
    @ViewBuilder func unwired(_ note: String?) -> some View {
        if let note {
            Text("unwired · waits on \(note)")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.state.attention)
        }
    }

    private var states: some View {
        section("Operational states — none of them the brand") {
            HStack(spacing: ArgoSpacing.comfortable) {
                ForEach(Array(zip(ArgoOperationalState.allCases, stateWords)), id: \.1) {
                    SpecimenStatusChip(state: $0, label: $1)
                }
            }
        }
    }

    /// Two rungs, each against the line it belongs on. The judgement this exists for is whether
    /// a rung reads as a mark ON the line or as an object beside it — which no assertion can make.
    private var icons: some View {
        section("Icon scale — two rungs, picked by meaning") {
            VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
                ForEach(ArgoIconSize.ladder, id: \.name) { rung in
                    HStack(spacing: ArgoSpacing.snug) {
                        ArgoGlyph(ArgoSymbol.project, rung.size)
                        ArgoGlyph(ArgoSymbol.branch, rung.size)
                        ArgoGlyph(ArgoSymbol.disclosure, rung.size)
                        Text("\(rung.name) · \(Int(rung.size.rawValue))pt")
                            .argoText(ArgoTypography.machineCaption)
                            .foregroundStyle(argo.color.text.tertiary)
                    }
                }
            }
        }
    }

    private var brand: some View {
        section("Ion Blue — brand, selection, focus, and nothing else") {
            HStack(spacing: ArgoSpacing.comfortable) {
                Button("Primary") {}.buttonStyle(.borderedProminent)
                Button("Secondary") {}.buttonStyle(.bordered)
                Toggle("Auto-follow", isOn: .constant(true)).toggleStyle(.switch)
            }
            .argoText(ArgoTypography.control)
        }
    }

    /// The scale itself, every rung at its own size. Named as the HIG names them, because it IS the
    /// HIG's scale — this is where a rung is judged against the one above it rather than asserted.
    private var scale: some View {
        section("Type scale — the platform's own, from largeTitle to caption2") {
            VStack(alignment: .leading, spacing: ArgoSpacing.snug) {
                ForEach(ArgoTypeScale.ladder, id: \.name) { rung in
                    HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
                        Text("\(rung.name) · \(Int(rung.rung.size))pt")
                            .argoText(ArgoTypography.machineCaption)
                            .foregroundStyle(argo.color.text.tertiary)
                            .frame(width: 132, alignment: .leading)
                        Text("The record of a Session").argoText(rung.rung)
                    }
                }
            }
        }
    }

    private var type: some View {
        section("Type roles — SF Pro for what the interface says, SF Mono for machine facts") {
            VStack(alignment: .leading, spacing: ArgoSpacing.base) {
                ForEach(ArgoTypography.all, id: \.name) { role in
                    HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
                        Text(role.name)
                            .argoText(ArgoTypography.machineCaption)
                            .foregroundStyle(argo.color.text.tertiary)
                            .frame(width: 132, alignment: .leading)
                        Text(sample(for: role.style.typeface)).argoText(role.style)
                        unwired(ArgoTypography.unwired[role.name])
                    }
                }
            }
        }
    }

    private var motion: some View {
        section("Motion — every role, its duration, and its Reduce Motion answer") {
            VStack(alignment: .leading, spacing: ArgoSpacing.snug) {
                ForEach(ArgoMotion.all, id: \.name) { role in
                    HStack(spacing: ArgoSpacing.loose) {
                        Text(role.name)
                            .argoText(ArgoTypography.machineCaption)
                            .frame(width: 132, alignment: .leading)
                        Text(duration(role.motion))
                            .argoText(ArgoTypography.machineCaption)
                        unwired(ArgoMotion.unwired[role.name])
                    }
                    .foregroundStyle(argo.color.text.secondary)
                }
            }
        }
    }

    func section(
        _ title: String,
        @ViewBuilder content: () -> some View,
    )
        -> some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            Text(title)
                .argoText(ArgoTypography.sectionLabel)
                .foregroundStyle(argo.color.text.tertiary)
            content()
        }
    }

    private let stateWords = ["running", "idle", "needs you", "failed"]

    private func sample(for typeface: ArgoTypeface) -> String {
        switch typeface {
        case .interface: "The cockpit observes what the agents are doing"
        case .machine: "git rev-parse HEAD → cb63695"
        }
    }

    private func duration(_ motion: ArgoMotion) -> String {
        let reduced = motion.reducedDuration.map { "\(Int($0 * 1000))ms fade" } ?? "instant"
        return "\(Int(motion.duration * 1000))ms · reduce motion: \(reduced)"
    }
}

#Preview("Contract roles") {
    ContractSpecimen()
        .frame(width: 820, height: 900)
        .argoAppearance()
}
