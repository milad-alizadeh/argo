import AppKit
import ArgoEngine
import SwiftUI

/// The composer's field as SwiftUI sees it: a growing, scrolling `NSTextView` (#734).
///
/// A TextKit 1 stack, built by hand rather than taken from `NSTextView`'s convenience initialiser.
/// The measurement is the reason: `usedRect` counts the empty fragment a trailing newline leaves,
/// which is exactly the line the reader just made with Shift-Return, and the field has to grow onto
/// it the moment they press the key.
struct ComposerTextView: NSViewRepresentable {
    @Environment(\.argo) private var argo

    @Binding var text: String
    /// What a screen reader is told this field is. Set on the AppKit view itself: SwiftUI's
    /// accessibility modifiers do not reach inside a representable's own subview.
    let placeholder: String
    let submit: () -> Void
    let walk: (ComposerKeyIntent) -> Bool
    let dismiss: () -> Bool
    let attach: ([SessionAttachment]) -> Void

    func makeNSView(context: Context) -> NSScrollView {
        let input = ComposerTextInput(frame: .zero, textContainer: context.coordinator.container)
        Self.dress(input)
        input.delegate = context.coordinator
        return Self.scroller(around: input)
    }

    func updateNSView(_ scroller: NSScrollView, context: Context) {
        guard let input = scroller.documentView as? ComposerTextInput else { return }
        input.setAccessibilityLabel(placeholder)
        Self.ink(input, argo: argo)
        Self.write(text, into: input, argo: argo)
        input.submit = submit
        input.walk = walk
        input.dismiss = dismiss
        input.attach = attach
        context.coordinator.text = $text
        context.coordinator.argo = argo
    }

    static func dismantleNSView(_: NSScrollView, coordinator: Coordinator) {
        coordinator.cancelReconciliation()
    }

    /// What the field asks for: one line at rest, the content's own height as it grows, and the
    /// ceiling past that — where the words scroll inside the field rather than pushing the feed up.
    func sizeThatFits(
        _ proposal: ProposedViewSize,
        nsView scroller: NSScrollView,
        context _: Context,
    )
        -> CGSize? {
        guard let width = proposal.width, width > 0,
              let input = scroller.documentView as? ComposerTextInput else { return nil }
        return CGSize(width: width, height: Self.height(of: input, at: width))
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    /// The draft written back as the reader types, and the owner of the text stack.
    ///
    /// The stack is held HERE because TextKit's ownership runs one way: storage keeps the layout
    /// manager, which keeps the container, which keeps the view. Nothing keeps the STORAGE, so a
    /// stack built inside `makeNSView` is deallocated on the way out and the field has no text
    /// storage at all, and a draft written into it draws nothing. The coordinator is what SwiftUI
    /// keeps for the field's lifetime, and holding it from outside the chain leaves no cycle.
    @MainActor final class Coordinator: NSObject, NSTextViewDelegate {
        var text: Binding<String>
        /// The theme the last update carried, so a reconciliation inks what it writes.
        var argo: ArgoTheme = .graphite

        let storage = NSTextStorage()
        let container: NSTextContainer
        /// The draft's last word over the field, taken a turn after the field reported a change
        /// (#1000).
        ///
        /// `updateNSView` is the only other writer, and SwiftUI reaches it when the DRAFT it
        /// renders differs from the draft it last rendered — never when the FIELD differs from
        /// the draft. A keystroke and the Return that sends it land in one turn: the draft goes
        /// from empty to the line and back to empty with no update pass between, so SwiftUI is
        /// handed the value it already drew, skips the field, and a sent line stays in it — and
        /// concatenates onto the next Turn.
        ///
        /// Scheduled in `.common` and not `.default`, so a draft that moved during event tracking
        /// — a scroll, a seam drag, an open menu — reaches the field then rather than whenever the
        /// tracking loop ends. Counted rather than held: `RunLoop` hands back no cancellable
        /// token, so the generation the block was queued with is what tells a stale one to stop.
        private var reconciliation = 0

        init(text: Binding<String>) {
            self.text = text
            self.container = NSTextContainer(size: CGSize(
                width: 0,
                height: CGFloat.greatestFiniteMagnitude,
            ))
            container.widthTracksTextView = true
            // Zero, because the vessel already holds the words off its own rim: AppKit's default 5
            // would set the field's first character a further 5pt in from every other line in the
            // composer.
            container.lineFragmentPadding = 0
            let layout = NSLayoutManager()
            layout.addTextContainer(container)
            storage.addLayoutManager(layout)
            super.init()
        }

        func textDidChange(_ notification: Notification) {
            guard let input = notification.object as? ComposerTextInput else { return }
            text.wrappedValue = input.string
            reconciliation += 1
            let queued = reconciliation
            RunLoop.main.perform(inModes: [.common]) { [weak self, weak input] in
                guard let self, let input, queued == reconciliation else { return }
                ComposerTextView.write(text.wrappedValue, into: input, argo: argo)
            }
        }

        /// Retire whatever is queued, so a field taken down between the keystroke and the turn
        /// after it is not written into on the way out.
        func cancelReconciliation() {
            reconciliation += 1
        }
    }
}

private extension ComposerTextView {
    /// The control's own settings, none of which is a style: every one of them is a behaviour the
    /// stock field had and the reader would notice losing.
    static func dress(_ input: ComposerTextInput) {
        input.isRichText = false
        input.importsGraphics = false
        input.allowsUndo = true
        input.drawsBackground = false
        input.isVerticallyResizable = true
        input.isHorizontallyResizable = false
        input.textContainerInset = .zero
        // The clip view sets the width and the text sets the height. Without both of these the
        // view keeps the zero frame it was built with, and a draft in it draws nothing at all.
        input.autoresizingMask = [.width]
        input.minSize = .zero
        input.maxSize = CGSize(
            width: CGFloat.greatestFiniteMagnitude,
            height: CGFloat.greatestFiniteMagnitude,
        )
        // Off, all four: a draft is a line somebody is about to hand a CLI, and a smart quote or an
        // em dash substituted into `--flag "x"` is a command that no longer runs.
        input.isAutomaticQuoteSubstitutionEnabled = false
        input.isAutomaticDashSubstitutionEnabled = false
        input.isAutomaticTextReplacementEnabled = false
        input.isAutomaticSpellingCorrectionEnabled = false
    }

    /// The draft into the field, and only where the two disagree: writing it back on every pass
    /// would drop the caret to the end of the line mid-sentence, and would cut a marked
    /// composition — a Pinyin or a dead-key sequence — off at the first keystroke.
    ///
    /// A write of its own leaves the caret at the END, which is where every writer there is wants
    /// it: a menu's insertion, a restored draft, a Turn put back (#682), and the clear after a
    /// send are each an append or a replacement of the whole line.
    ///
    /// It re-inks, because the attributes are held on the range they were applied to and a new
    /// string carries none of them. The HEIGHT needs nothing of the sort: the field is
    /// `isVerticallyResizable`, so TextKit resizes the document view under the write and AppKit
    /// carries that up to the next layout pass.
    static func write(_ draft: String, into input: ComposerTextInput, argo: ArgoTheme) {
        guard input.string != draft, !input.hasMarkedText() else { return }
        input.string = draft
        ink(input, argo: argo)
    }

    /// The face and the two inks, reapplied on every update because the theme can turn under a
    /// field that is already holding a draft.
    static func ink(_ input: ComposerTextInput, argo: ArgoTheme) {
        input.font = face
        input.defaultParagraphStyle = paragraph
        input.typingAttributes = [.font: face, .paragraphStyle: paragraph]
        input.textColor = argo.color.text.primary.nsColor
        input.insertionPointColor = argo.color.text.primary.nsColor
        input.textStorage?.addAttributes(
            [.font: face, .paragraphStyle: paragraph],
            range: NSRange(location: 0, length: input.string.utf16.count),
        )
    }

    /// The body rung through AppKit's own table, so the field and every `Text` beside it are set at
    /// one size — see `ArgoTypeScale+AppKit`.
    static var face: NSFont {
        NSFont.preferredFont(forTextStyle: ArgoTypography.body.rung.appKitStyle)
    }

    /// The study's 1.5 line height, held as a floor and a ceiling on the line box. The number the
    /// stock control could not draw at all.
    ///
    /// The face's own leading comes OFF the box, because TextKit adds it on top: at 19.5 flat a
    /// fragment measures 20.19, six of them are 121 against a ceiling that says 117, and the sixth
    /// line is drawn cut in half. The subtraction the feed's `proseLineSpacing` does, from the
    /// other end.
    static var paragraph: NSParagraphStyle {
        let style = NSMutableParagraphStyle()
        let box = max(0, ArgoComposerVessel.fieldLineHeight - Self.face.leading)
        style.minimumLineHeight = box
        style.maximumLineHeight = box
        return style
    }

    static func scroller(around input: ComposerTextInput) -> NSScrollView {
        let scroller = NSScrollView()
        scroller.documentView = input
        scroller.drawsBackground = false
        scroller.hasVerticalScroller = false
        scroller.hasHorizontalScroller = false
        scroller.autohidesScrollers = true
        scroller.verticalScrollElasticity = .none
        return scroller
    }

    /// What the words occupy at this width, between one line and the ceiling.
    static func height(of input: ComposerTextInput, at width: CGFloat) -> CGFloat {
        guard let layout = input.layoutManager, let container = input.textContainer else {
            return ArgoComposerVessel.fieldLineHeight
        }
        container.size = CGSize(width: width, height: .greatestFiniteMagnitude)
        layout.ensureLayout(for: container)
        let used = layout.usedRect(for: container).height
        return min(
            max(used, ArgoComposerVessel.fieldLineHeight),
            ArgoComposerVessel.fieldHeightCeiling,
        )
    }
}
