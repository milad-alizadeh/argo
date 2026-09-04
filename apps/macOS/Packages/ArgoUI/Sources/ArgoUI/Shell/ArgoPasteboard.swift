import AppKit

/// The one way text and images leave the cockpit: `clearContents` before the write, in one place.
enum ArgoPasteboard {
    static func put(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    static func put(_ image: NSImage) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.writeObjects([image])
    }
}
