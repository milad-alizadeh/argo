import AppKit

// What a reader who is not looking gets. A `Text` published its own words and its own link runs for
// free; a surface that inks glyphs itself publishes nothing at all unless it says so, and a row
// nothing can read is a row that is not there (#777).

extension ProseSurface {
    override func isAccessibilityElement() -> Bool {
        true
    }

    override func accessibilityRole() -> NSAccessibility.Role? {
        .staticText
    }

    /// The record's own words, verbatim — the marks included, because they are what the agent
    /// wrote. `FeedProse` combines this into the row's own label where a row has one.
    override func accessibilityValue() -> Any? {
        showing?.text
    }

    /// One element per link, at the rectangle its words were inked at, so the links a pointer can
    /// reach are the links a keyboard and VoiceOver can reach.
    ///
    /// Labelled with what the link is CALLED where Argo has its own name for it, and with its
    /// address otherwise: a Ticket the screen says `#1175` must not be read out as a URL (#1178).
    override func accessibilityChildren() -> [Any]? {
        links.map { place in
            let element = NSAccessibilityElement()
            element.setAccessibilityRole(.link)
            element.setAccessibilityLabel(words(place.url) ?? place.url.absoluteString)
            element.setAccessibilityParent(self)
            element.setAccessibilityFrameInParentSpace(place.rect)
            return element
        }
    }
}
