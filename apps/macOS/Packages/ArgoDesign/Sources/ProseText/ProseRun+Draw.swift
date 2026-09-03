import AppKit
import ArgoDesign

/// What a run of prose is inked in. A value rather than four arguments, so a surface and a
/// specimen cannot pass them in different orders, and so the parameter cap holds.
///
/// Every colour here is the caller's claim. The module states no hue: it draws what it is handed
/// (`ArgoDesign` is where a colour may be declared).
public struct ProseInk {
    /// The voice the block is set in. Applied to every glyph the record marked as nothing, so one
    /// typeset answers for a message and for the quieter thought beside it.
    public var body: ArgoColor
    /// A `[label](url)`, underlined as well as inked — colour alone is not a link.
    public var link: ArgoColor
    /// A `code` span's glyphs, where inheriting the voice would fall under the contrast floor on
    /// the span's own ground. `nil` inherits, which is the ordinary case.
    public var span: ArgoColor?
    /// The chip drawn under a `code` span — what marks the run, rather than a hue.
    public var marked: ProseMarkedInk

    public init(body: ArgoColor, link: ArgoColor, span: ArgoColor?, marked: ProseMarkedInk) {
        self.body = body
        self.link = link
        self.span = span
        self.marked = marked
    }

    /// The same ink in another voice — a list's marker is drawn quieter than the words beside it,
    /// and everything else about how a run is marked stays as it was.
    public func voiced(_ body: ArgoColor) -> ProseInk {
        var voiced = self
        voiced.body = body
        return voiced
    }
}

extension ProseInk: Equatable {}

/// The chip a `code` span is drawn on: its ground, how far that ground is pushed past the glyphs,
/// and how round its corner is. One reading, so it travels as one value.
public struct ProseMarkedInk: Equatable {
    public var ground: ArgoColor
    public var inset: CGSize
    public var radius: CGFloat

    public init(ground: ArgoColor, inset: CGSize, radius: CGFloat) {
        self.ground = ground
        self.inset = inset
        self.radius = radius
    }
}

/// One inking in progress: where the run's top-left corner sits, what it is set in, and what it is
/// drawn into. A value because the three travel together and the cap on a parameter list is real.
private struct ProseInking {
    let origin: CGPoint
    let ink: ProseInk
    let context: CGContext
}

public extension ProseRun {
    /// The run inked into `context`, its top-left corner at `origin`, in a FLIPPED space — the one
    /// an `NSView` that reads top-down draws in.
    ///
    /// Grounds first over the whole run, then glyphs. Drawn line by line interleaved, a span's
    /// ground would paint over the tail of the word before it wherever two boxes overlap.
    @MainActor func draw(at origin: CGPoint, ink: ProseInk, in context: CGContext) {
        let marked = ink.marked
        for span in spans where span.isCode {
            context.setFillColor(marked.ground.cgColor)
            context.addPath(CGPath(
                roundedRect: span.rect.offsetBy(dx: origin.x, dy: origin.y)
                    .insetBy(dx: -marked.inset.width, dy: -marked.inset.height),
                cornerWidth: marked.radius,
                cornerHeight: marked.radius,
                transform: nil,
            ))
            context.fillPath()
        }
        let inking = ProseInking(origin: origin, ink: ink, context: context)
        for (at, line) in lines.enumerated() {
            draw(line, onLine: at, into: inking)
        }
    }

    /// One line, run by run. Each run takes its own ink off the context's fill colour, which is why
    /// the typeset carries no colour of its own: `CTRunDraw` inks a run with no `.foregroundColor`
    /// attribute in whatever the context is filling with.
    @MainActor private func draw(_ line: CTLine, onLine at: Int, into inking: ProseInking) {
        let context = inking.context
        context.saveGState()
        defer { context.restoreGState() }
        context.textMatrix = .identity
        context.translateBy(
            x: inking.origin.x, y: inking.origin.y + baseline(ofLine: at),
        )
        context.scaleBy(x: 1, y: -1)
        context.textPosition = .zero
        for run in Self.runs(of: line) {
            let marks = CTRunGetAttributes(run) as NSDictionary
            let url = marks[NSAttributedString.Key.link] as? URL
            context.setFillColor(
                inked(url: url, isCode: Self.isCode(marks), ink: inking.ink).cgColor,
            )
            CTRunDraw(run, context, CFRange())
            guard url != nil else { continue }
            underline(run, in: context)
        }
    }

    /// A link wins over a code span where a run is both, which is what the underline says too.
    private func inked(url: URL?, isCode: Bool, ink: ProseInk) -> ArgoColor {
        if url != nil {
            return ink.link
        }
        return isCode ? ink.span ?? ink.body : ink.body
    }

    /// The rule under a link's words, at the font's own underline position and thickness — drawn
    /// here because a `CTRun` carries no underline attribute of its own.
    private func underline(_ run: CTRun, in context: CGContext) {
        let marks = CTRunGetAttributes(run) as NSDictionary
        guard let font = marks[NSAttributedString.Key.font] as? NSFont else { return }
        var start = CGPoint.zero
        CTRunGetPositions(run, CFRange(location: 0, length: 1), &start)
        let width = CGFloat(CTRunGetTypographicBounds(run, CFRange(), nil, nil, nil))
        // The context is already flipped and translated onto this line's baseline, so the
        // underline's own offset — negative, below the baseline — is added as the font states it.
        context.fill(CGRect(
            x: start.x,
            y: font.underlinePosition,
            width: width,
            height: max(ArgoStroke.hairline, font.underlineThickness),
        ))
    }
}
