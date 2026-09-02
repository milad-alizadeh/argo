import ArgoDesign
import SwiftUI

/// The room's three nothings, told apart (#818, #820). ONE view for all of them: the contrast IS
/// the thing being built, and three views would let the sentences drift apart.
struct TicketsRoomVacancy: View {
    @Environment(\.argo) private var argo

    let vacancy: TicketsRoomProjection.Vacancy
    /// The Project the room is scoped to, named in both sentences. Absent where the window has no
    /// active Project, and the sentences drop the clause rather than saying "this Project" twice.
    let project: String?
    let connect: @MainActor () -> Void

    var body: some View {
        ContentUnavailableView {
            Text(title)
                .argoText(ArgoTypography.identityHeading)
                .foregroundStyle(argo.color.text.primary)
                .frame(maxWidth: ArgoTicketsRoomVacancy.panelWidth)
        } description: {
            Text(message)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.tertiary)
                // On the Text: `ContentUnavailableView` sizes its description to a measure of its
                // own, and a frame outside it never reaches the line breaks.
                .frame(width: ArgoTicketsRoomVacancy.panelWidth)
        } actions: {
            if case .unbound = vacancy {
                connectButton
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// A `Button` restyled through the contract, which is the shape every accent-filled control in
    /// this app takes. `.borderedProminent` composites its tint through the system's own material,
    /// so it draws a paler blue under a white label — neither is the contract's accent pair.
    private var connectButton: some View {
        Button(action: connect) {
            Text("Connect a provider…")
                .argoText(ArgoTypography.control)
                .foregroundStyle(argo.color.text.onAccent)
                .padding(.horizontal, ArgoSpacing.comfortable)
                .padding(.vertical, ArgoSpacing.snug)
                .background(
                    argo.color.interaction.accent,
                    in: RoundedRectangle(cornerRadius: ArgoRadius.control),
                )
        }
        .buttonStyle(.plain)
    }

    private var title: String {
        switch vacancy {
        case .unbound:
            project.map { "No Ticket provider is connected to \($0)" }
                ?? "No Ticket provider is connected"
        case let .unread(provider):
            "Nothing has been read from \(provider) yet"
        case .nothingOpen:
            project.map { "Nothing open in \($0)" } ?? "Nothing open"
        case .nothingClosed:
            project.map { "Nothing closed in \($0)" } ?? "Nothing closed"
        }
    }

    /// The sentence that separates them: the two that have read nothing say so in as many words,
    /// because all three pages are one glance apart.
    private var message: String {
        switch vacancy {
        case .unbound:
            """
            Argo reads tickets through a provider you connect per Project. Nothing here has been \
            read yet — this is not an empty backlog.
            """
        case let .unread(provider):
            """
            Argo is connected to \(provider) and has had no answer back for this Project. This is \
            not an empty backlog — the connection at the foot of the sidebar says how the read is \
            going.
            """
        case let .nothingOpen(provider):
            """
            \(provider) answered: every Ticket it exposes for this Project is closed. Nothing \
            is waiting to be picked up.
            """
        case let .nothingClosed(provider):
            """
            \(provider) answered: nothing it exposes for this Project has been closed yet. \
            Nothing has been finished, rather than nothing being left to do.
            """
        }
    }
}

#Preview("Tickets room vacancy — the two nothings, side by side") {
    HStack(spacing: ArgoSpacing.flush) {
        TicketsRoomVacancy(vacancy: .unbound, project: "argo", connect: {})
        TicketsRoomVacancy(vacancy: .nothingOpen(provider: "GitHub"), project: "argo", connect: {})
    }
    .frame(width: 1080, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Tickets room vacancy — no active Project to name") {
    TicketsRoomVacancy(vacancy: .unbound, project: nil, connect: {})
        .frame(width: 540, height: 420)
        .argoDeckSurface()
        .argoAppearance()
}
