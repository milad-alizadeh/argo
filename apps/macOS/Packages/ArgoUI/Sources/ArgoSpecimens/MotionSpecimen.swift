import ArgoAtoms
import ArgoDesign
import ArgoUI
import SwiftUI

/// Every motion role, its duration and what it does when the reader has movement off.
///
/// A sheet of its own as well as a section of the contract's, for the reason `IconButtonSpecimen`
/// has one: the contract sheet is longer than any window, and the motion section sits near its
/// foot, so it was in no render anybody looked at. The Atlas doubled the roster (#1420), which is
/// exactly when a list nobody can see stops being a list nobody needs to see.
struct MotionSpecimen: View {
    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            MotionRoles()
        }
        .padding(ArgoSpacing.region)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .argoDeckSurface()
    }
}

/// The rows themselves, so the contract sheet and the sheet above draw one thing rather than two
/// that have to be kept in step.
struct MotionRoles: View {
    @Environment(\.argo) private var argo

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.snug) {
            ForEach(ArgoMotion.all, id: \.name) { role in
                HStack(spacing: ArgoSpacing.loose) {
                    Text(role.name)
                        .argoText(ArgoTypography.machineCaption)
                        .frame(width: 132, alignment: .leading)
                    Text(said(role.motion, cooling: role.name == ArgoWaitAge.cooledRole))
                        .argoText(ArgoTypography.machineCaption)
                    unwired(ArgoMotion.unwired[role.name])
                }
                .foregroundStyle(argo.color.text.secondary)
            }
            staggers
        }
    }

    /// The two roles the map spreads across many boxes. Their span is the other half of what the
    /// reader waits, and a sheet that showed the duration alone would show half of each.
    private var staggers: some View {
        ForEach(ArgoMotion.staggered, id: \.name) { role in
            HStack(spacing: ArgoSpacing.loose) {
                Text("\(role.name) span")
                    .argoText(ArgoTypography.machineCaption)
                    .frame(width: 132, alignment: .leading)
                Text(
                    "+\(Int(role.stagger * 1000))ms across the plan · \(Int(role.wait * 1000))ms end to end",
                )
                .argoText(ArgoTypography.machineCaption)
            }
            .foregroundStyle(argo.color.text.tertiary)
        }
    }

    /// A loop is read differently from a transition, so it is said differently: its number is a
    /// period rather than a wait, and Reduce Motion stops it rather than shortening it. Only the
    /// role `ArgoWaitAge` cools also says so — the ladder is a property of the WAIT it reports, and
    /// a cord that has been live for an hour is not a wait — so the clause is asked for.
    private func said(_ motion: ArgoMotion, cooling: Bool) -> String {
        let reduced = motion.reducedDuration.map { "\(Int($0 * 1000))ms fade" } ?? "instant"
        let pass = "\(Int(motion.duration * 1000))ms"
        let coldest = Int(ArgoWaitAge.coldest.period * 1000)
        guard motion.repeats else { return "\(pass) · reduce motion: \(reduced)" }
        let cools = cooling ? ", cooling to \(coldest)ms" : ""
        return "\(pass) per pass\(cools) · reduce motion: stopped"
    }

    /// A role nothing draws yet, and what it waits on.
    @ViewBuilder
    private func unwired(_ note: String?) -> some View {
        if let note {
            Text("unwired · waits on \(note)")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.state.attention)
        }
    }
}

#Preview("Motion roles") {
    MotionSpecimen()
        .frame(width: 820, height: 520)
        .argoAppearance()
}
