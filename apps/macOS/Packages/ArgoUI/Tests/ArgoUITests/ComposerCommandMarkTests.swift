import AppKit
import ArgoDesign
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// The colour mark over the command the CLI will actually run — #1256's second half. The rule
/// itself is `ComposerMenuCommandsTests`; this proves the field really paints it.
@Suite("Composer field — command mark")
@MainActor struct ComposerCommandMarkTests {
    @Test
    func `a command at the head of the draft is inked in the accent`() throws {
        let field = try ComposerFieldHost.hosted(over: ComposerSpecimen.commands)

        field.input.insertText("/implement 745", replacementRange: field.input.selectedRange())
        // `insertText` sets the control's own string synchronously; the mark is painted by the
        // reconciliation `ComposerTextView` schedules a turn later (#1000), so the wait is on the
        // colour landing and not on the string, which already matches.
        field.settle {
            field.color(at: 0 ..< 10) == ArgoTheme.graphite.color.interaction.accent.nsColor
        }

        #expect(field.color(at: 0 ..< 10) == ArgoTheme.graphite.color.interaction.accent.nsColor)
        #expect(field.color(at: 10 ..< 14) == ArgoTheme.graphite.color.text.primary.nsColor)
    }

    /// The menu still opens two lines down (`ComposerMenuCommandsTests`), but the CLI would never
    /// run this as a command — it is not the head of the draft — so the field marks nothing.
    @Test
    func `a command opened after the first line is not marked`() throws {
        let field = try ComposerFieldHost.hosted(over: ComposerSpecimen.commands)
        let text = "go with these variations\n\n/prototype-to-design"

        field.input.insertText(text, replacementRange: field.input.selectedRange())
        field.settle { field.input.string == text }

        let whole = 0 ..< (text as NSString).length
        #expect(field.color(at: whole) == ArgoTheme.graphite.color.text.primary.nsColor)
    }
}

private extension ComposerFieldHost {
    /// The colour the field's own text storage carries at `range`, or `nil` where the run is not
    /// uniform — a test asking a mixed range a single colour is a test asking the wrong question.
    func color(at range: Range<Int>) -> NSColor? {
        var seen: NSColor?
        var uniform = true
        input.textStorage?.enumerateAttribute(
            .foregroundColor,
            in: NSRange(location: range.lowerBound, length: range.count),
        ) { value, _, _ in
            let color = value as? NSColor
            if let seen, color != seen {
                uniform = false
            }
            seen = color
        }
        return uniform ? seen : nil
    }
}
