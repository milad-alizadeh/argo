import ArgoDesign
import CoreGraphics

/// Which voice a run of prose is set in. The three the surface inks itself; a fence, a table, a
/// picture and a diagram lay themselves out and are drawn by the views that already draw them.
///
/// Three rather than one, because a heading is not the paragraph under it (#1597).
public enum ProseVoiceKind: Sendable, CaseIterable {
    /// A `#` through `######` line — the heading over the block that answers it.
    case heading
    /// Running prose: a paragraph, and the words of a list item.
    case body
    /// A list item's own marker, in its column beside the words.
    case marker
}

/// One voice: the glyphs a block is set in, and what a `code` span inside it falls back to.
///
/// The two travel together because the second is a floor UNDER the first, and a span floored
/// against a voice its block is not set in is a span drawn at the wrong distance from the words
/// around it.
public struct ProseVoice: Equatable, Sendable {
    /// The ink every glyph the record marked as nothing is set in.
    public var ink: ArgoColor
    /// A `code` span's glyphs, where inheriting `ink` would fall under the contrast floor on the
    /// span's own ground. `nil` inherits, which is the ordinary case.
    public var span: ArgoColor?

    public init(ink: ArgoColor, span: ArgoColor? = nil) {
        self.ink = ink
        self.span = span
    }
}

/// A voice per kind of block. Named slots and not a lookup: a kind nothing answered would be a
/// block set in no ink at all, and there is no honest value for that.
public struct ProseVoices: Equatable, Sendable {
    public var heading: ProseVoice
    public var body: ProseVoice
    public var marker: ProseVoice

    public init(heading: ProseVoice, body: ProseVoice, marker: ProseVoice) {
        self.heading = heading
        self.body = body
        self.marker = marker
    }

    public subscript(kind: ProseVoiceKind) -> ProseVoice {
        switch kind {
        case .heading: heading
        case .body: body
        case .marker: marker
        }
    }
}

/// What a run of prose is inked in. A value rather than four arguments, so a surface and a
/// specimen cannot pass them in different orders, and so the parameter cap holds.
///
/// Every colour here is the caller's claim. The module states no hue: it draws what it is handed
/// (`ArgoDesign` is where a colour may be declared), and it pairs no kind with a rung either —
/// which of the ramp's rungs a heading is owed is the calling surface's decision.
public struct ProseInk: Equatable {
    /// The voice each kind of block is set in.
    public var voices: ProseVoices
    /// A `[label](url)`, underlined as well as inked — colour alone is not a link.
    public var link: ArgoColor
    /// The chip drawn under a `code` span — what marks the run, rather than a hue.
    public var marked: ProseMarkedInk
    /// Which of the voices this inking speaks in. A run draws in ONE of them, and a surface picks
    /// it per block with `voiced(_:)`.
    public private(set) var speaking: ProseVoiceKind = .body

    public init(voices: ProseVoices, link: ArgoColor, marked: ProseMarkedInk) {
        self.voices = voices
        self.link = link
        self.marked = marked
    }

    /// The voice this inking draws in — the glyphs, and the floor a `code` span in them takes.
    public var voice: ProseVoice {
        voices[speaking]
    }

    /// The same ink speaking as another kind: a heading is drawn louder than the words under it
    /// and a list's marker quieter than the words beside it, and everything else about how a run
    /// is marked stays as it was.
    public func voiced(_ kind: ProseVoiceKind) -> ProseInk {
        var voiced = self
        voiced.speaking = kind
        return voiced
    }
}

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
