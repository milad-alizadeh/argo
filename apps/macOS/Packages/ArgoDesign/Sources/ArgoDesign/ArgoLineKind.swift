import SwiftUI

/// What a run of text IS — which is what picks the rung it is set in.
///
/// `TextRoles` says how loud each rung is; `ArgoTypography` says what face and size a line takes.
/// Neither said which rung a title, a caption or a section header was owed, so every call site
/// answered for itself and the answers did not agree: 139 of the shell's readings sat on the two
/// quietest rungs against 56 on the loudest, and the Tickets room read as one grey tone (#1250).
///
/// A kind is not a MEANING — a hue says meaning, and the ramp is a loudness (`TextRoles`). It is
/// the job the line does on the surface, and the pairing below is the one place that job becomes
/// an ink.
public enum ArgoLineKind: String, Sendable, CaseIterable {
    /// The subject of the thing it sits on: a row's name, a pane's head, a panel's head, a
    /// heading inside a body of prose. The loudest rung, whether or not the row is selected —
    /// a row nobody has clicked is still live text.
    case title
    /// Running prose — a ticket's body, a message in the reading. One rung under the title over
    /// it, which is what makes a paragraph read as the answer to a heading rather than a second
    /// heading.
    case body
    /// The word naming a block of rows, set over it rather than in it. Chrome about the content,
    /// so it is quieter than anything under it.
    case sectionHeader
    /// The quiet line beside or under a title, in the interface face — what a Session is doing,
    /// a ticket's status word.
    case metadata
    /// A branch, an id, a count, an elapsed clock: what the machine says, in the machine face.
    case machineFact
    /// A control a person cannot use. The ONE kind that takes the `disabled` rung, which is an
    /// absence rather than a voice and carries no contrast floor. Live text is never this,
    /// however quiet it is meant to read — an empty state is quiet, not dead.
    case disabled

    /// Whether a line of this kind is text somebody can still read and act on. Every kind but
    /// `disabled` is, and each of those is held to `TextRoles.contrastFloor`.
    public var isLive: Bool {
        self != .disabled
    }
}

public extension ArgoPalette.TextRoles {
    /// The rung a line of this kind is set in. The whole pairing, in one switch, so a retune is
    /// one edit rather than a sweep of the call sites.
    ///
    /// Three kinds share `tertiary` and that is deliberate: the ramp has four rungs and the
    /// interface writes six kinds of line, so the kinds are what stay distinct while the rungs
    /// merge. Splitting them later is an edit here and nowhere else.
    func ink(_ kind: ArgoLineKind) -> ArgoColor {
        switch kind {
        case .title: primary
        case .body: secondary
        case .sectionHeader, .metadata, .machineFact: tertiary
        case .disabled: disabled
        }
    }
}

public extension ArgoPalette {
    /// The ink the asking surface's wand takes — lit where the surface is offering the ask, quiet
    /// where it is only naming it (#1317).
    ///
    /// Here rather than at either call site because the field's own lead and the offer's two lines
    /// draw the SAME mark, and a mark that meant the accent in one place and a text rung in the
    /// other would be two marks. The quiet answer is a KIND and not a rung, so neither call site
    /// hand-picks one (`check:text-ink`).
    func askMark(lit: Bool) -> ArgoColor {
        lit ? interaction.accentBright : text.ink(.metadata)
    }
}

public extension View {
    /// A line's face and its ink in one call: the typography role says what it looks like, the
    /// kind says how loud it is. Preferred over `argoText` plus a hand-picked `foregroundStyle`,
    /// because the pair chosen together is the thing that drifted.
    ///
    /// The palette comes from the environment rather than a parameter, so a light appearance
    /// arrives without touching a call site.
    func argoLine(_ style: ArgoTextStyle, _ kind: ArgoLineKind) -> some View {
        argoText(style).foregroundStyle(ArgoLineInk(kind: kind))
    }
}

/// The kind's ink, resolved against whatever appearance the line is drawn under.
///
/// A `ShapeStyle` rather than a `ViewModifier`, because the contract holds tokens and declares no
/// view: edge 7b of `scripts/swift-boundaries.sh` is what says so, and a style that resolves
/// itself is how a token reaches the environment without one.
private struct ArgoLineInk: ShapeStyle {
    let kind: ArgoLineKind

    func resolve(in environment: EnvironmentValues) -> some ShapeStyle {
        environment.argo.color.text.ink(kind).color
    }
}
