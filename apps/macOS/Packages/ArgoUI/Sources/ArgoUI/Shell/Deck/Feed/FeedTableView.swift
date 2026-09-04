import AppKit
import ArgoAtoms
import SwiftUI

/// The feed's table — `NSTableView` plus the keyboard verbs the reading answers to. Closures
/// rather than a delegate: the coordinator is already both of the delegates a table has.
final class FeedTableView: NSTableView {
    /// One row up or down. Consumes the arrows whether or not a row is focused yet — the move
    /// itself scrolls the landing row into view, so the keys still move the reading.
    var stepFocus: ((Int) -> Void)?
    /// Return and Space, both — what a focused control answers to on this platform. Answers whether
    /// the row took it; a key an inert row refused falls through to the table's own handling.
    var activateFocused: (() -> Bool)?
    /// A key the table's own handling scrolled by — Space paging, Home, End. Reported so the
    /// follow latch reads the landing; a paged scroll is the reader's as much as a wheel's.
    var keyScrolled: (() -> Void)?
    /// The window's live resize beginning — the moment the geometry freezes. The seam's own drag
    /// arrives as a model flag instead (`FeedTableModel.isResizing`); this is the other hand on an
    /// edge, and AppKit is the only thing that can report it.
    var liveResizeBegan: (() -> Void)?
    /// The window's live resize ending — the moment the deferred full re-measure runs.
    var liveResizeEnded: (() -> Void)?
    /// The reading's own frame changing — its SHAPE, which the clip view's frame cannot say. A
    /// closure and not a second frame observer, so the pair of decisions the deck makes about a
    /// frame is reached from one registration (#971).
    var reshaped: (() -> Void)?
    /// Whether the reading is where the keyboard is, in the sense the row cursor is drawn on: the
    /// keyboard is here AND the keyboard is what the reader is working with (#533).
    var keyboardMoved: ((Bool) -> Void)?
    /// The focused row's own words, or `nil` when there are none to take. Read twice — to answer
    /// ⌘C, and to grey Edit ▸ Copy out over a reading with nothing selectable in it.
    var focusedWords: (() -> String?)?

    /// How many times the reading has been laid out. One layout pass realises and sizes every
    /// cell on screen, so this is the one honest count of what a mount or a landing COST — see
    /// `FeedMountCostTests`. Not DEBUG-only: it is one increment on a path that already lays out
    /// a screenful of SwiftUI.
    private(set) var layouts = 0

    override func layout() {
        layouts += 1
        super.layout()
    }

    /// Whether the reader has hold of an edge — the deck's seam or the window's own frame
    /// (ADR-0030, Rule 6).
    ///
    /// Frozen, the reading stays at the width it was MEASURED across and the clip view shows
    /// whatever fits. That is the whole of "clipped and unreflowed": a width AppKit moves at drag
    /// rate is a width every visible cell re-lays out against, over a document whose heights are
    /// not allowed to follow it — so the reader would be shown prose wrapped one way at heights
    /// taken for another, for every frame of the drag.
    ///
    /// Let go, the size AppKit last asked for is applied at once, so the reading catches the pane
    /// up in one step rather than waiting for the next thing that happens to resize it.
    var isFrozen = false {
        didSet {
            guard !isFrozen, let owed = owedSize else { return }
            owedSize = nil
            setFrameSize(owed)
        }
    }

    /// The size AppKit asked for while the width was frozen — see `isFrozen`.
    private var owedSize: NSSize?

    /// How the reader is working. The app's one reader by default; a suite hands the table its own
    /// rather than share a mutable global between cases.
    var reader = ArgoFocusVisibility.shared

    /// The last event the app took off its queue — `NSApp`'s own, as a closure so a suite can
    /// state one: the claims below are about WHICH press a hand-over came in on.
    var currentEvent: () -> NSEvent? = { NSApp.currentEvent }

    /// Whether the hand-over in hand came in on a key. Asked of the event rather than of
    /// `ArgoFocusVisibility`, which answers for the whole cockpit: a reader typing in the composer
    /// is working the keyboard, and a reading handed the keys under them was still handed them by
    /// something else (#1180).
    var isKeyDriven: Bool {
        currentEvent()?.type == .keyDown
    }

    /// Arriving is not the same as arriving BY keyboard, and neither of those is the reader
    /// DRIVING this reading. A click that lands in the reading makes this the first responder just
    /// as a Tab does, and so does the deck opening on a Session picked in the roster — a reader
    /// working the keys elsewhere in the cockpit is a keyboard reader who asked this reading for
    /// nothing (#1180).
    ///
    /// So the cursor comes on for the one arrival the reader steered into the reading: a Tab.
    /// Every other route waits for a key pressed in the reading itself.
    override func becomeFirstResponder() -> Bool {
        let arrived = super.becomeFirstResponder()
        if arrived {
            keyboardMoved?(reader.isOn && isTab(currentEvent()))
        }
        return arrived
    }

    /// A Tab or a back-Tab, as against whatever else the arrival came in on.
    private func isTab(_ event: NSEvent?) -> Bool {
        guard let event, isKeyDriven else { return false }
        return event.specialKey == .tab || event.specialKey == .backTab
    }

    override func resignFirstResponder() -> Bool {
        let left = super.resignFirstResponder()
        if left {
            keyboardMoved?(false)
        }
        return left
    }

    /// A click inside a reading the keyboard was ALREADY in — the one path no responder change
    /// reports, and the one that left the ring standing under the pointer.
    override func mouseDown(with event: NSEvent) {
        super.mouseDown(with: event)
        keyboardMoved?(false)
    }

    override func keyDown(with event: NSEvent) {
        // A key in the reading is the reader working it by keyboard, whether or not it moves the
        // cursor — the counterpart of `mouseDown` below.
        keyboardMoved?(true)
        if event.specialKey == .upArrow {
            stepFocus?(-1)
        } else if event.specialKey == .downArrow {
            stepFocus?(1)
        } else if isActivation(event) {
            if activateFocused?() != true {
                super.keyDown(with: event)
                keyScrolled?()
            }
        } else {
            super.keyDown(with: event)
            keyScrolled?()
        }
    }

    /// Edit ▸ Copy, arriving at the reading: the focused row's words, as the agent wrote them
    /// (#767).
    ///
    /// The responder action rather than a key in `keyDown`, because the menu item claims ⌘C before
    /// the event reaches a view. Reaching for it is keyboard work, so the cursor comes back onto
    /// the row being taken — a copy off a row with no cursor drawn would be a paste from nowhere.
    @objc func copy(_: Any?) {
        guard let words = focusedWords?() else { return }
        keyboardMoved?(true)
        ArgoPasteboard.put(words)
    }

    override func viewWillStartLiveResize() {
        super.viewWillStartLiveResize()
        liveResizeBegan?()
    }

    override func viewDidEndLiveResize() {
        super.viewDidEndLiveResize()
        liveResizeEnded?()
    }

    /// The table taken out of its window, which is the OTHER way a drag ends.
    ///
    /// AppKit sends `viewDidEndLiveResize` to the views in the window it is resizing, so a view
    /// removed from that window mid-drag never hears the end of the drag it is in. A reading frozen
    /// for a drag that can no longer end is a reading nothing measures again, so the end is
    /// reported here too — the deck that goes off screen under the reader's hand comes back
    /// measurable.
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        guard window == nil else { return }
        liveResizeEnded?()
    }

    /// Every route AppKit resizes this view by ends here, which is what makes it the seam the
    /// document's own frame notification used to be. Reported unconditionally, for the reason that
    /// notification was: a size that did not move is the routine case, and the decision about it
    /// belongs to whoever is mapping the reading.
    ///
    /// The WIDTH is refused while the reading is frozen. Height still follows: a document that grew
    /// is the rows the coordinator has already put up, and refusing that would draw the reading
    /// short of its own end.
    override func setFrameSize(_ newSize: NSSize) {
        defer { reshaped?() }
        guard isFrozen else { return super.setFrameSize(newSize) }
        owedSize = newSize
        super.setFrameSize(NSSize(width: frame.width, height: newSize.height))
    }

    private func isActivation(_ event: NSEvent) -> Bool {
        event.specialKey == .carriageReturn
            || event.specialKey == .enter
            || event.charactersIgnoringModifiers == " "
    }
}

extension FeedTableView {
    /// Greys Edit ▸ Copy out over a reading with nothing to take. Every other item is left to the
    /// table's own answer.
    override func validateUserInterfaceItem(_ item: NSValidatedUserInterfaceItem) -> Bool {
        guard item.action == #selector(copy(_:)) else {
            return super.validateUserInterfaceItem(item)
        }
        return focusedWords?() != nil
    }
}
