import ArgoDesign
import SwiftUI

/// One dot per running Subagent, in the leading column under the state dot
/// (`cockpit-roster-row.md`, `data-component: SubagentDots`). Four readings, and each is a
/// different fact — see `SessionRosterProjection.SubagentReading`.
struct SubagentDots: View {
    @Environment(\.argo) private var argo

    /// Five is where a stack stops being countable at a glance, and the figure is exact where a
    /// longer stack is texture.
    nonisolated static let ceiling = 5

    let reading: SessionRosterProjection.SubagentReading

    var body: some View {
        switch reading {
        case .none:
            EmptyView()
        case let .running(count):
            running(count)
        case .landed:
            // Delegated, and all of them are home: one dash. Not an outline — that reading is
            // already spoken for by `.unresolved`, and two outlines under one dot would read as
            // two dots.
            Capsule()
                .fill(argo.color.text.tertiary)
                .frame(width: ArgoIconSize.subagentDot, height: ArgoStroke.border)
        case .unresolved:
            // An open delegation Argo cannot resolve (#1076): an outline pip, never a number.
            Circle()
                .strokeBorder(argo.color.text.tertiary, lineWidth: ArgoStroke.hairline)
                .frame(width: ArgoIconSize.subagentDot, height: ArgoIconSize.subagentDot)
        }
    }

    private func running(_ count: Int) -> some View {
        VStack(spacing: ArgoSpacing.subagentGap) {
            ForEach(0 ..< Self.drawnDots(for: count), id: \.self) { _ in
                Circle()
                    .fill(argo.color.text.tertiary)
                    .frame(width: ArgoIconSize.subagentDot, height: ArgoIconSize.subagentDot)
            }
            if let overflow = Self.overflow(for: count) {
                // `fixedSize` first, so the text lays out at its own ideal width rather than the
                // one the frame below proposes — the frame then only CENTRES it over the fixed
                // six-point column, and the glyphs overflow evenly on both sides rather than
                // truncating to fit. The column itself does not grow: it is still 6pt to every
                // sibling that measures it.
                Text("+\(overflow)")
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.tertiary)
                    .lineLimit(1)
                    .fixedSize()
                    .frame(width: ArgoIconSize.statusDot)
            }
        }
    }

    /// How many dots a count this size draws — never past the ceiling, where the figure past it
    /// takes over instead. `nonisolated`: pure arithmetic, asked from a suite off the main actor.
    nonisolated static func drawnDots(for count: Int) -> Int {
        min(count, ceiling)
    }

    /// What the `+n` label says, or `nil` under the ceiling where the dots are the whole count.
    nonisolated static func overflow(for count: Int) -> Int? {
        count > ceiling ? count - ceiling : nil
    }
}

#Preview("Subagent dots — the four readings, and the ceiling") {
    HStack(alignment: .top, spacing: ArgoSpacing.comfortable) {
        SubagentDots(reading: .none)
        SubagentDots(reading: .running(3))
        SubagentDots(reading: .running(12))
        SubagentDots(reading: .landed)
        SubagentDots(reading: .unresolved)
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}
