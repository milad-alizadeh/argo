import ArgoDesign
import SwiftUI

/// What a control draws under its mark. An icon button is the same box on every surface; what
/// changes is whether it sits in a vessel somebody else drew, carries one of its own, or fills.
public enum ArgoControlGround: Sendable {
    /// Nothing. The mark alone — a segment inside a vessel, or a control on a row that already
    /// draws its own ground.
    case plain
    /// A solid disc: the composer's send, which is the one act on the row and wears the accent for
    /// it.
    case fill(ArgoColor)
    /// The button carries its own glass container, on a band whose other containers carry theirs.
    /// No tint and no shadow — a toolbar item hides the shared background and draws this instead,
    /// so it cannot merge with the container beside it.
    case glass
    /// Glass over a reading the control floats above, which is a different claim: it is present
    /// because the reader is in a state, and `argoFloatingGlass` carries the tint and the rim that
    /// say so.
    case floatingGlass
}

/// How an icon control is DRAWN — the three readings that vary from one surface to the next. One
/// value rather than three parameters, so a call site reads as a box, an ink and a ground rather
/// than as a list.
public struct ArgoControlFace: Sendable {
    /// Defaulted, and a caller overriding it needs a reason beside its own number — see
    /// `ArgoControlBox`.
    public let box: CGFloat
    /// The mark's ink while the control is LIVE. Disabled it draws `text.disabled` instead,
    /// wherever this face is applied.
    public let ink: ArgoColor
    public let ground: ArgoControlGround

    public init(
        box: CGFloat = ArgoControlBox.icon,
        ink: ArgoColor,
        ground: ArgoControlGround = .plain,
    ) {
        self.box = box
        self.ink = ink
        self.ground = ground
    }
}

/// What an icon control SAYS. It carries no word on its face, so this is the whole of it.
public struct ArgoControlVoice: Sendable {
    /// What the mark means, said in words for VoiceOver and, unless `help` says otherwise, for the
    /// pointer too.
    public let label: String
    /// The tooltip, where it says MORE than the label rather than something else — the key that
    /// presses this control, or the wait that has replaced the verb. Nil takes the label, because
    /// a tooltip and a label that disagree are two claims about one control.
    public let help: String?

    public init(_ label: String, help: String? = nil) {
        self.label = label
        self.help = help
    }
}

public extension View {
    /// Draws this mark as an icon control's face: the settled box, its ink, its ground, and the
    /// shape a pointer has to find.
    ///
    /// For a control `ArgoIconButton` cannot own — a `Menu`, whose label is not a button. Anything
    /// that IS a button takes the atom instead, so the press, the tooltip and the spoken label
    /// arrive with the box rather than beside it.
    func argoControlFace(_ face: ArgoControlFace) -> some View {
        modifier(ArgoControlFaceModifier(face: face))
    }
}

/// The face, applied. A modifier and not a plain `View` extension because the disabled ink is read
/// from the environment: `.buttonStyle(.plain)` over an explicit `foregroundStyle` dims for nobody,
/// so a control disabled in place picks its own ink (#275) — and one atom picking it is what stops
/// two surfaces answering the same state in two inks.
struct ArgoControlFaceModifier: ViewModifier {
    @Environment(\.argo) private var argo
    @Environment(\.isEnabled) private var isEnabled

    let face: ArgoControlFace

    func body(content: Content) -> some View {
        content
            .foregroundStyle(isEnabled ? face.ink : argo.color.text.disabled)
            .frame(width: face.box, height: face.box)
            .argoControlGround(face.ground)
            // The CIRCLE and not the square around it: the corners of a box that draws nothing
            // would take clicks meant for whatever is behind them.
            .contentShape(.circle)
    }
}

extension View {
    @ViewBuilder
    func argoControlGround(_ ground: ArgoControlGround) -> some View {
        switch ground {
        case .plain: self
        case let .fill(ink): background(ink, in: .circle)
        case .glass: glassEffect(in: .circle)
        case .floatingGlass: argoFloatingGlass(in: .circle)
        }
    }
}

/// One icon-only button: the whole of what such a control draws, on every surface that has one.
///
/// It exists because five surfaces hand-rolled the same `Button` + `frame` + `contentShape` +
/// `help` + `accessibilityLabel` stack and measured five different boxes doing it (#1243). The box
/// is `ArgoControlBox`, and a caller overrides it only where the number answers to something other
/// than the button.
public struct ArgoIconButton<Mark: View>: View {
    private let voice: ArgoControlVoice
    private let face: ArgoControlFace
    /// No default. A mark drawn over `{}` looks live and is not, which is what #900 shipped — so
    /// the act is written at every call site, including a preview's.
    private let act: () -> Void
    private let mark: Mark

    public init(
        voice: ArgoControlVoice,
        face: ArgoControlFace,
        act: @escaping () -> Void,
        @ViewBuilder mark: () -> Mark,
    ) {
        self.voice = voice
        self.face = face
        self.act = act
        self.mark = mark()
    }

    public var body: some View {
        Button(action: act) {
            mark.argoControlFace(face)
        }
        .buttonStyle(.plain)
        .help(voice.help ?? voice.label)
        .accessibilityLabel(voice.label)
    }
}

public extension ArgoIconButton where Mark == ArgoGlyph {
    /// The ordinary case: one symbol at the control rung, in the settled box. `ArgoIconSize` is not
    /// a parameter — a mark that IS the control is drawn at `control`, and a button wanting another
    /// rung is a button drawing something other than its own mark.
    ///
    /// `control` (13) and not the work-room study's 14: 14 is the SVG box the study drew its icons
    /// into, where `control` is the rung the contract already gives "a control's own mark" — and a
    /// fourth rung would be a token change no one room has standing to make.
    init(
        _ symbol: String,
        voice: ArgoControlVoice,
        face: ArgoControlFace,
        act: @escaping () -> Void,
    ) {
        self.init(voice: voice, face: face, act: act, mark: { ArgoGlyph(symbol, .control) })
    }
}

#Preview("Icon buttons — one box, and the grounds a surface puts under it") {
    @Previewable @Environment(\.argo) var argo

    HStack(spacing: ArgoSpacing.comfortable) {
        ArgoIconButton(
            ArgoSymbol.copyLink,
            voice: ArgoControlVoice("Copy link"),
            face: ArgoControlFace(ink: argo.color.text.tertiary),
            act: {},
        )
        ArgoIconButton(
            ArgoSymbol.openOnHost,
            voice: ArgoControlVoice("Open on host"),
            face: ArgoControlFace(ink: argo.color.text.tertiary),
            act: {},
        )
        .disabled(true)
        ArgoIconButton(
            ArgoSymbol.send,
            voice: ArgoControlVoice("Send", help: "Send — Return"),
            face: ArgoControlFace(
                ink: argo.color.text.onAccent,
                ground: .fill(argo.color.interaction.accent),
            ),
            act: {},
        )
        ArgoIconButton(
            ArgoSymbol.newSession,
            voice: ArgoControlVoice("New Session"),
            face: ArgoControlFace(
                box: ArgoControlBox.vessel,
                ink: argo.color.text.primary,
                ground: .glass,
            ),
            act: {},
        )
        ArgoIconButton(
            ArgoSymbol.latest,
            voice: ArgoControlVoice("Newest"),
            face: ArgoControlFace(ink: argo.color.text.secondary, ground: .floatingGlass),
            act: {},
        )
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
