import AppKit

// The annotation half of the lane (#382): which Turn the pointer is naming, the Ion Blue line that
// spans it, and the prompt drawn over the miniature for it.
//
// Its own layer, and the only one a hover touches. The marks bitmap is never re-rasterised for a
// pointer moving over the lane — an annotation is something laid ON the miniature, not part of it.
//
// The line is drawn for the named Turn ALONE. Every Turn wearing one at rest turned the lane into a
// near-continuous blue rail, which spent the app's loudest colour on saying "there are Turns here"
// — a thing a session always has.

extension MinimapLaneView {
    /// The annotations re-resolved and drawn. Nothing happens when they say the same thing, which
    /// is most pointer moves: a Turn is many points tall and the pointer crosses it many times.
    func settleAnnotations() {
        guard let palette else { return }
        let wanted = wantedAnnotations()
        guard wanted != drawnAnnotations || palette.text.primary != labelled else { return }
        annotationRedraws += 1
        drawnAnnotations = wanted
        labelled = palette.text.primary
        annotationsLayer.frame = bounds
        annotationsLayer.contentsScale = window?.backingScaleFactor ?? 2
        annotationsLayer.contents = wanted.isEmpty ? nil : annotationBitmap(of: wanted)
    }

    /// What the lane should be marking: the Turn under the pointer, or every Turn on screen while
    /// ⇧⌘ is held. Nothing at all when the pointer is off the lane and no modifier is down.
    private func wantedAnnotations() -> [MinimapAnnotation] {
        let slide = geometry.laneOffset(at: feed?.offset() ?? 0)
        guard !showsEveryPrompt else {
            let window = slide ... slide + bounds.height
            return MinimapAnnotation
                .legible(geometry.blocks(in: window).map { annotation(of: $0, slidBy: slide) })
        }
        guard let hovered, let block = geometry.block(atMiniatureY: hovered + slide) else {
            return []
        }
        return [annotation(of: block, slidBy: slide)]
    }

    private func annotation(of block: MinimapBlock, slidBy slide: CGFloat) -> MinimapAnnotation {
        MinimapAnnotation(
            span: (block.y - slide) ... (block.y + block.height - slide), words: block.prompt,
        )
    }

    private func annotationBitmap(of annotations: [MinimapAnnotation]) -> CGImage? {
        let scale = annotationsLayer.contentsScale
        guard bounds.width > 0, bounds.height > 0,
              let context = CGContext(
                  data: nil,
                  width: Int(bounds.width * scale),
                  height: Int(bounds.height * scale),
                  bitsPerComponent: 8,
                  bytesPerRow: 0,
                  space: CGColorSpaceCreateDeviceRGB(),
                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue,
              )
        else {
            return nil
        }
        context.scaleBy(x: scale, y: scale)
        // Flipped, so everything below is written in lane coordinates — which count down from the
        // top, as the reading does. AppKit is told the same, so a string lands right side up.
        context.translateBy(x: 0, y: bounds.height)
        context.scaleBy(x: 1, y: -1)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: true)
        for annotation in annotations {
            draw(annotation, in: context)
        }
        NSGraphicsContext.restoreGraphicsState()
        return context.makeImage()
    }

    /// One Turn marked: the words on a ground so they can be read over the miniature, and the Ion
    /// Blue line spanning the block — drawn last, so the ground never covers the mark it explains.
    ///
    /// Real text at a real rung. Nothing here is scaled after drawing, which is what keeps it
    /// legible rather than a smear of the right shape.
    private func draw(_ annotation: MinimapAnnotation, in context: CGContext) {
        guard let palette else { return }
        if let words = annotation.words {
            let padding = ArgoMinimapLane.labelPadding
            let ground = CGRect(
                x: 0, y: labelY(of: annotation),
                width: bounds.width, height: ArgoMinimapLane.labelHeight,
            )
            context.setFillColor(palette.surface.overlay.cgColor)
            context.fill(ground)
            NSAttributedString(string: words, attributes: labelAttributes(in: palette))
                .draw(in: ground.insetBy(dx: padding, dy: padding))
        }
        context.setFillColor(palette.interaction.accent.cgColor)
        context.fill(CGRect(
            x: ArgoMinimapLane.turnLineInset,
            y: annotation.span.lowerBound,
            width: ArgoMinimapLane.turnLineWidth,
            height: annotation.span.upperBound - annotation.span.lowerBound,
        ))
    }

    /// Where the label's ground sits: at the head of the block, held inside the lane — a Turn
    /// running off the top still has to say what it is.
    private func labelY(of annotation: MinimapAnnotation) -> CGFloat {
        let floor = max(0, bounds.height - ArgoMinimapLane.labelHeight)
        return min(max(0, annotation.span.lowerBound), floor)
    }

    private func labelAttributes(in palette: ArgoPalette) -> [NSAttributedString.Key: Any] {
        let paragraph = NSMutableParagraphStyle()
        // One line, cut at the end. A prompt is a sentence and the lane is narrow, so the reader
        // gets its opening — which is the part that says which Turn this is.
        paragraph.lineBreakMode = .byTruncatingTail
        return [
            .font: NSFont.preferredFont(forTextStyle: ArgoMinimapLane.labelRung.appKitStyle),
            .foregroundColor: palette.text.primary.nsColor,
            .paragraphStyle: paragraph,
        ]
    }
}
