import AppKit

/// The one way text leaves the cockpit: `clearContents` before the write, in one place.
enum ArgoPasteboard {
    static func put(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }
}
