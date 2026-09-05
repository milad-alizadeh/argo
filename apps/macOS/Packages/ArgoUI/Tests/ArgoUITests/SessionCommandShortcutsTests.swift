@testable import ArgoUI
import Foundation
import SwiftUI
import Testing

/// The Session menu's keys against the rule over them (#1297): the menu shares its window with the
/// composer and the rename field, and a menu-bar shortcut outranks whichever has focus.
///
/// It takes two tests because the two halves cannot be made one thing. SwiftUI gives no way to read
/// a `keyboardShortcut` back off a View, so the value is asserted here and the view is held to
/// reading its keys from that value, out of the repository's own source — the route
/// `AccentAssetTests` takes for the same reason.
@Suite("Session menu shortcuts")
struct SessionCommandShortcutsTests {
    @Test
    func `archive answers to no key`() {
        #expect(SessionCommandShortcuts.archive == nil)
    }

    @Test
    func `rename answers to command R`() {
        #expect(SessionCommandShortcuts.rename == KeyboardShortcut("r", modifiers: .command))
    }

    /// Without this the value above proves nothing: a literal put back on the Archive `Button`
    /// binds ⌘⌫ again and leaves every other test green.
    @Test
    func `the menu binds every key through that value, never a literal`() throws {
        let source = try String(contentsOf: Self.itemsURL, encoding: .utf8)
        let bindings = source.split(separator: "\n").filter { $0.contains(".keyboardShortcut(") }
        // Both items, so a file that stopped binding keys at all cannot pass by having none.
        #expect(bindings.count == 2)
        for binding in bindings {
            #expect(binding.contains(".keyboardShortcut(SessionCommandShortcuts."))
        }
    }

    /// The file in the repository, not the built module: a modifier leaves nothing in the binary to
    /// read back, and an `ArgoUI` test builds the package the source sits in.
    private static let itemsURL = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .appending(path: "Sources/ArgoUI/Shell/SessionCommandItems.swift")
}
