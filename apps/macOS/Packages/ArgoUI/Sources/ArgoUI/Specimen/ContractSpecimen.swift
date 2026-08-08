import SwiftUI

/// The contract's roles laid out side by side, for the one judgement the assembled cockpit
/// cannot give you: whether two states are still telling apart at a glance, and whether the
/// sans and the mono are still doing two different jobs.
///
/// It exists for the preview canvas and nothing else. The app window shows the cockpit — a
/// specimen sheet in a shipping surface is how a palette stops being judged in context.
struct ContractSpecimen: View {
    @Environment(\.argo) private var argo

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ArgoSpacing.section) {
                surfaces
                states
                brand
                type
                icons
                motion
            }
            .padding(ArgoSpacing.section)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .argoDeckSurface()
    }

    private var surfaces: some View {
        section("Surfaces — near-black graphite, depth from tone and edge") {
            HStack(spacing: 0) {
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

    /// Three rungs, each against the line it belongs on. The judgement this exists for is whether
    /// a rung reads as a mark ON the line or as an object beside it — which no assertion can make.
    private var icons: some View {
        section("Icon scale — three rungs, picked by meaning") {
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

    private var type: some View {
        section("Type — SF Pro for everything the interface says, SF Mono for machine facts") {
            VStack(alignment: .leading, spacing: ArgoSpacing.base) {
                ForEach(ArgoTypography.all, id: \.name) { role in
                    HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
                        Text(role.name)
                            .argoText(ArgoTypography.machineCaption)
                            .foregroundStyle(argo.color.text.tertiary)
                            .frame(width: 132, alignment: .leading)
                        Text(sample(for: role.style.typeface)).argoText(role.style)
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
                    }
                    .foregroundStyle(argo.color.text.secondary)
                }
            }
        }
    }

    private func section(
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
