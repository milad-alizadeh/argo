import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// Which skill the Session opens on — the pill's second segment, and the command it draws IS the
/// control (`cockpit-work-room.md`, #1242).
///
/// **The thing you read is the thing you press to change.** A chevron beside a fact, with the fact
/// itself inert, is two controls over one thing; the token opens the menu and the chevron is only
/// the mark that says it can be opened.
///
/// **This is not #872's chevron coming back.** That one offered Mode rungs over a Session that did
/// not exist yet: one honest answer, confirmed on every open, and a control downstream — the
/// composer's, over a live Session whose rung it reads back — that owns the fact properly. This
/// offers the command, which has six answers, whose default is a GUESS off a ticket's labels
/// rather than a value the reader set, and which nothing downstream can change: the command is the
/// first thing sent, and no control anywhere re-opens a Session on a different one.
///
/// **The default costs nobody a click.** Pressing the word beside this starts the resolved command,
/// exactly as it did before — which is the test #872 applied and the Mode menu failed.
///
/// **Every row starts a Session ATTACHED to this ticket**, including `Fresh Session`, and the menu
/// says so rather than leaving it to be inferred. That is what makes the picker worth having: the
/// agent has the ticket in context, so `/grill-me` grills this ticket and `/triage` triages it.
struct StartSkillMenu: View {
    @Environment(\.argo) private var argo

    /// The command the ticket resolved to, and `nil` where it asks for none. It is checked in the
    /// menu, so the guess is inspectable rather than magic.
    let command: WorkCommand?
    /// Start on a command the reader picked instead — `nil` is the Fresh Session, which carries
    /// the ticket and no command.
    let pick: (WorkCommand?) -> Void

    var body: some View {
        Menu {
            Section("Start a Session on this ticket") {
                ForEach(WorkCommand.offered, id: \.self) { offer in
                    Button { pick(offer) } label: { row(for: offer) }
                }
            }
            Divider()
            Button("Fresh Session") { pick(nil) }
        } label: {
            label
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .fixedSize()
        .help(help)
        .accessibilityLabel(help)
    }

    /// The token and the mark that says it opens. `Toggle`-free and unchecked here: the check is
    /// inside the menu, where a reader is choosing, and a mark out here would be a second claim.
    private var label: some View {
        HStack(spacing: ArgoSpacing.snug) {
            if let command {
                StartCommandWord(command: command)
            } else {
                // The ticket matched no rule. The word says what the press does rather than
                // leaving an empty segment nobody can aim — and `Start` beside it still opens the
                // empty composer, which is the honest answer to a ticket that asks for nothing.
                Text("pick a skill")
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.tertiary)
                    .fixedSize()
            }
            ArgoDisclosure(.below)
                .foregroundStyle(argo.color.text.tertiary)
        }
        .argoSegmentFace()
    }

    /// A row names the command and, where the resolver had a reason, why it matched. The reason is
    /// only ever on the one that DID match — stating a rule beside a command nobody picked would
    /// read as a claim about that command.
    @ViewBuilder private func row(for offer: WorkCommand) -> some View {
        if offer == command, let why = WorkCommand.why(offer) {
            Text("\(offer.typed) — \(why)")
        } else {
            Text(offer.typed)
        }
    }

    private var help: String {
        guard let command else { return "Pick the skill this Session opens on" }
        return "Opens on \(command.typed) — press to pick another skill"
    }
}

#Preview("Start skill menu") {
    ArgoIconButtonGroup {
        StartSkillMenu(command: .implement, pick: { _ in })
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
