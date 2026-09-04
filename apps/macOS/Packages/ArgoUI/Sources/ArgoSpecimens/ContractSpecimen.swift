import ArgoAtoms
import ArgoDesign
import ArgoUI
import SwiftUI

/// The contract's roles laid out side by side, for the one judgement the assembled cockpit
/// cannot give you: whether two roles are still telling apart at a glance. The type roles make
/// that judgement in `ContractSpecimen+Type`; the colour, series and shape roles in their own.
///
/// **Every role in the palette appears here**, and `VisualContractTests` proves it by reflection.
/// The swatches read their names and values off the `all` arrays rather than repeating them, so
/// adding a role adds a swatch.
///
/// It renders whatever appearance is in the environment — nothing here knows it is dark.
struct ContractSpecimen: View, SpecimenSheet {
    @Environment(\.argo) var argo

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ArgoSpacing.section) {
                surfaces
                text
                edges
                states
                diff
                series
                ramps
                brand
                scale
                type
                icons
                controls
                shape
                presence
                depth
                motion
                syntax
            }
            .padding(ArgoSpacing.section)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .argoDeckSurface()
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
                        Text("\(rung.name) · \(Int(rung.size.rawValue), format: .machine)pt")
                            .argoText(ArgoTypography.machineCaption)
                            .foregroundStyle(argo.color.text.tertiary)
                    }
                }
            }
        }
    }

    private var brand: some View {
        section("Ion Blue — brand, selection, focus, and nothing else") {
            VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
                HStack(spacing: ArgoSpacing.comfortable) {
                    Button("Primary") {}.buttonStyle(.borderedProminent)
                    Button("Secondary") {}.buttonStyle(.bordered)
                    Toggle("Auto-follow", isOn: .constant(true)).toggleStyle(.switch)
                }
                .argoText(ArgoTypography.control)
                selectionGround
            }
        }
    }

    /// The hue's OTHER weight (#875), resolved OPAQUE (#922) so the platform's selection capsule
    /// cannot show through it. Drawn by hand because `interaction.all` is catalogued by the
    /// `Mirror` gate but rendered by no loop, so a role in it can still ship unlooked-at.
    ///
    /// Both rungs side by side, because that is the only way two weights of one hue can be judged,
    /// and the row's own quietest voice on it, because that is what set the weight.
    private var selectionGround: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
            label("selectionGround")
            HStack(spacing: ArgoSpacing.snug) {
                Text("A Session, selected")
                    .foregroundStyle(argo.color.text.primary)
                Text("4m ago")
                    .foregroundStyle(argo.color.text.tertiary)
            }
            .argoText(ArgoTypography.body)
            .padding(.horizontal, ArgoSpacing.base)
            .padding(.vertical, ArgoSpacing.snug)
            .background(argo.color.interaction.selectionGround)
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

    /// The words the roster actually spends, so the legibility specimen proves the ink on the text
    /// it is drawn under.
    private let stateWords = ["running", "idle", "Needs input", "Stopped"]

    /// A loop is read differently from a transition, so it is said differently: its number is a
    /// period rather than a wait, it cools as the wait it reports ages, and Reduce Motion stops it
    /// rather than shortening it.
    private func duration(_ motion: ArgoMotion) -> String {
        let reduced = motion.reducedDuration.map { "\(Int($0 * 1000))ms fade" } ?? "instant"
        let pass = "\(Int(motion.duration * 1000))ms"
        let coldest = Int(ArgoWaitAge.coldest.period * 1000)
        return motion.repeats
            ? "\(pass) per pass, cooling to \(coldest)ms · reduce motion: stopped"
            : "\(pass) · reduce motion: \(reduced)"
    }
}

#Preview("Contract roles") {
    ContractSpecimen()
        .frame(width: 820, height: 900)
        .argoAppearance()
}
