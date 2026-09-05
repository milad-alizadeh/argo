import ArgoDesign
import SwiftUI

/// One group of the Atlas sidebar: a name over the controls it governs (the design's `.sbsec`).
///
/// Group header, group, group header, group — the shape a settings sidebar has, and the reason
/// every section here is the same view rather than four stacks that drifted apart. It draws no
/// ground: the sidebar column stands on the platform's own material.
public struct AtlasSidebarSection<Content: View>: View {
    @Environment(\.argo) private var argo

    private let title: String
    private let content: Content

    public init(_ title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.snug) {
            Text(title)
                .textCase(.uppercase)
                .argoText(ArgoTypography.sectionLabel)
                .foregroundStyle(argo.color.text.tertiary)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, ArgoSpacing.comfortable)
        .padding(.vertical, ArgoSpacing.base)
        .accessibilityElement(children: .contain)
    }
}

/// One field of a section: what it is, and the control that sets it (the design's `.srow`).
///
/// Every field carries its name — a control with nothing beside it is a puzzle, whatever it is
/// made of.
public struct AtlasSidebarRow<Control: View>: View {
    @Environment(\.argo) private var argo

    private let label: String
    private let control: Control

    public init(_ label: String, @ViewBuilder control: () -> Control) {
        self.label = label
        self.control = control()
    }

    public var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            Text(label)
                .argoText(ArgoTypography.control)
                .foregroundStyle(argo.color.text.secondary)
            Spacer(minLength: ArgoSpacing.base)
            control
        }
        // A FLOOR, not a frame: the row has to grow with the reader's own text size, the way
        // `ArgoTicketsSidebar.viewRowHeight` does.
        .frame(minHeight: Self.rowHeight)
    }

    /// What a row stands at with nothing stretching it — the design's own `.srow` minimum.
    static var rowHeight: CGFloat {
        26
    }
}
