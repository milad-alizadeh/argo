import SwiftUI

/// The panel that sets a Project up, and the panel Project Settings re-enters.
///
/// Three independent rows in a fixed order, completable in any order, none of them blocking
/// another: a folder, the two ports, and the companion plugin. The call to action goes live the
/// moment there is a folder, because a folder is the floor and everything else unlocks rather than
/// gates (#265). One surface for both lives, because Settings **is** this panel with one word
/// different on the button, which is what "no app-global Preferences" means in practice.
public struct ConnectPanel: View {
    @Environment(\.argo) private var argo

    private let panel: ConnectPanelProjection.Panel
    private let actions: ConnectPanelActions

    public init(reading: ConnectReading, actions: ConnectPanelActions) {
        self.panel = ConnectPanelProjection.panel(from: reading)
        self.actions = actions
    }

    /// A `Form`, which is what a Mac settings surface is. The rows, their ground, their insets and
    /// the label column all come from the platform, so this panel looks like the rest of macOS and
    /// keeps looking like it when macOS changes.
    public var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            // A sheet has no title bar to hang `navigationTitle` on, so the heading is a line of
            // its own, set at the identity rung and inset to the Form's own gutter.
            Text(panel.heading)
                .argoText(ArgoTypography.identityHeading)
                .foregroundStyle(argo.color.text.primary)
                .padding(.horizontal, ArgoSpacing.section)
                .padding(.top, ArgoSpacing.section)
            Form {
                Section { rows }
                if let challenge = panel.challenge {
                    Section {
                        DeviceCodeCard(challenge: challenge, stopWaiting: actions.stopWaiting)
                    }
                }
                if let note = panel.note {
                    Section { ConnectNoteView(note: note) }
                }
            }
            .formStyle(.grouped)
            call
                .padding(.horizontal, ArgoSpacing.section)
                .padding(.bottom, ArgoSpacing.section)
        }
        .frame(width: ArgoLayout.connectPanelWidth, alignment: .leading)
    }

    @ViewBuilder private var rows: some View {
        ConnectRow(row: panel.folder) {
            Button(panel.folderCall, action: actions.chooseFolder)
                .buttonStyle(.quiet)
        }
        ForEach(panel.ports) { port in
            ConnectPortRow(row: port, actions: actions)
        }
        ConnectRow(row: panel.companion) { EmptyView() }
        if let agent = panel.agent {
            ConnectRow(row: agent) { EmptyView() }
        }
    }

    /// One button, and it is the only thing on this panel that is ever disabled. What disables it
    /// is the absence of a folder and nothing else.
    ///
    /// The one accent-coloured control on the screen, and it is the system's own: a sheet's
    /// default button is drawn in the accent by macOS, and every other control here takes
    /// `QuietButtonStyle` so that this one is the only place the eye is sent.
    private var call: some View {
        HStack {
            Spacer(minLength: ArgoSpacing.flush)
            Button(panel.call, action: actions.finish)
                .argoText(ArgoTypography.control)
                .keyboardShortcut(.defaultAction)
                .disabled(!panel.isCallEnabled)
        }
    }
}

#Preview("Connect — nothing set yet") {
    ConnectPanel(reading: ConnectFixture.fresh, actions: .inert)
        .argoAppearance()
}

// A folder and nothing else: the observation floor, and a Project that already works. The state
// the whole "folder, not repository" rule exists for.
#Preview("Connect — a folder and nothing else") {
    ConnectPanel(reading: ConnectFixture.folderOnly, actions: .inert)
        .argoAppearance()
}

#Preview("Connect — half connected, already usable") {
    ConnectPanel(reading: ConnectFixture.partly, actions: .inert)
        .argoAppearance()
}

// Two identities on one provider, one per port. Whether they read as two different accounts
// without anybody opening a token is the judgement.
#Preview("Connect — both ports, two accounts") {
    ConnectPanel(reading: ConnectFixture.wired, actions: .inert)
        .argoAppearance()
}

#Preview("Connect — waiting on the browser") {
    ConnectPanel(reading: ConnectFixture.waiting, actions: .inert)
        .argoAppearance()
}

#Preview("Connect — a bind the provider refused") {
    ConnectPanel(reading: ConnectFixture.refused, actions: .inert)
        .argoAppearance()
}

#Preview("Project settings — the same panel, re-entered") {
    ConnectPanel(reading: ConnectFixture.settings, actions: .inert)
        .argoAppearance()
}
