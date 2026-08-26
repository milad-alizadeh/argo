import AppKit

// The annotation half of the lane (#382): which Turn is named, the Ion Blue line that spans it, and
// the prompt drawn beside it.
//
// Its own layer, and the only one a hover touches — the rects bitmap is never re-rasterised for a
// pointer moving over the lane.
//
// The label hangs to the LEFT of the lane, over the reading, right-aligned so it ends where the
// lane begins: the lane is four or five words wide, and a prompt cut there names no Turn.

extension MinimapLaneView {
    /// The annotations re-resolved and drawn. Nothing happens when they say the same thing, which
    /// is most pointer moves: a Turn is many points tall and the pointer crosses it many times.
    func settleAnnotations() {
        guard let palette else { return }
        let wanted = wantedAnnotations()
        guard wanted != marking || inked(palette) != labelled else { return }
        annotationRedraws += 1
        marking = wanted
        labelled = inked(palette)
        annotationsLayer.frame = annotationBounds
        annotationsLayer.contentsScale = backingScale
        annotationsLayer.contents = wanted.isEmpty ? nil : bitmap(of: wanted)
    }

    /// Where the annotation layer lives: the lane, plus room to its leading side for a label. Room
    /// enough for a sentence rather than for a word, and no more — it is drawn over the reading.
    private var annotationBounds: CGRect {
        CGRect(
            x: -ArgoMinimapLane.labelWidth,
            y: 0,
            width: bounds.width + ArgoMinimapLane.labelWidth,
            height: bounds.height,
        )
    }

    /// Every ink the annotations are drawn in, so a palette that moved any of them re-draws them.
    private func inked(_ palette: ArgoPalette) -> [ArgoColor] {
        [palette.text.primary, palette.surface.overlay, palette.interaction.accent]
    }

    /// What the lane should be marking: the Turn under the pointer, or every Turn on screen while
    /// ⇧⌘ is held. Nothing at all when the pointer is off the lane and no modifier is down.
    private func wantedAnnotations() -> [MinimapAnnotation] {
        guard hovered != nil || showsEveryPrompt else { return [] }
        let slide = geometry.laneOffset(at: feed?.offset() ?? 0)
        guard !showsEveryPrompt else {
            let window = slide ... slide + bounds.height
            return MinimapAnnotation.legible(
                geometry.blocks(in: window).map { annotation(of: $0, slidBy: slide) },
                inside: bounds.height,
            )
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

    private func bitmap(of annotations: [MinimapAnnotation]) -> CGImage? {
        let size = annotationBounds.size
        // Flipped, so everything drawn is written in lane coordinates — which count down from the
        // top, as the reading does. AppKit is told the same, so a string lands right side up.
        return flipped(size, scale: annotationsLayer.contentsScale) { context in
            for annotation in annotations {
                draw(annotation, in: context)
            }
        }
    }

    /// One Turn named: the words on a ground beside the lane, and the Ion Blue line spanning the
    /// block. Real text at a real rung, and nothing here is scaled after drawing — which is what
    /// keeps it legible rather than a smear of the right shape.
    private func draw(_ annotation: MinimapAnnotation, in context: CGContext) {
        guard let palette else { return }
        if let words = annotation.words {
            draw(words, at: annotation.labelY(inside: bounds.height), in: context)
        }
        // Stopped short of the next Turn: the block itself reaches it, so a hover never falls
        // between two, but two lines drawn end to end read as one line rather than as two Turns.
        let span = annotation.span.upperBound - annotation.span.lowerBound
        context.setFillColor(palette.interaction.accent.cgColor)
        context.fill(CGRect(
            x: ArgoMinimapLane.labelWidth + ArgoMinimapLane.turnLineInset,
            y: annotation.span.lowerBound,
            width: ArgoMinimapLane.turnLineWidth,
            height: max(ArgoMinimapLane.turnLineWidth, span - ArgoMinimapLane.turnLineGap),
        ))
    }

    /// The words, on a ground that hugs them and ends where the lane begins.
    private func draw(_ words: String, at top: CGFloat, in context: CGContext) {
        guard let palette else { return }
        let padding = ArgoMinimapLane.labelPadding
        let text = NSAttributedString(string: words, attributes: labelAttributes(in: palette))
        let room = ArgoMinimapLane.labelWidth - padding * 2
        let width = min(room, text.size().width)
        let ground = CGRect(
            x: ArgoMinimapLane.labelWidth - width - padding * 2,
            y: top,
            width: width + padding * 2,
            height: ArgoMinimapLane.labelHeight,
        )
        context.setFillColor(palette.surface.overlay.cgColor)
        context.fill(ground)
        text.draw(in: ground.insetBy(dx: padding, dy: padding))
    }

    private func labelAttributes(in palette: ArgoPalette) -> [NSAttributedString.Key: Any] {
        let paragraph = NSMutableParagraphStyle()
        // One line. There is room for a sentence beside the lane, and a prompt longer than that is
        // cut at the end rather than wrapped into a paragraph laid over the reading.
        paragraph.lineBreakMode = .byTruncatingTail
        paragraph.alignment = .right
        return [
            .font: NSFont.preferredFont(forTextStyle: ArgoMinimapLane.labelRung.appKitStyle),
            .foregroundColor: palette.text.primary.nsColor,
            .paragraphStyle: paragraph,
        ]
    }
}
