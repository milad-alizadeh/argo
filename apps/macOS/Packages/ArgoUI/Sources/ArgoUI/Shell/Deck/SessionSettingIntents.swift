import ArgoEngine

/// The three standing things the composer's footer can put the shown Session ON: its rung of the
/// Mode ladder (#545), and the CLI's own two knobs, Model and Effort (#558).
///
/// One value rather than three closures on `DeckIntents`, because they are one row of controls and
/// one act binds them — the run-settings popover's reset sets all three, in that order.
///
/// They stay THREE members and are never folded into one call, for the reason the design keeps Mode
/// off the run-settings popover: Mode is Argo's standing autonomy stance and the other two are the
/// CLI's, and an intent that set them together would be the composer implying that changing the
/// model changes how often you are asked.
///
/// Every one is `async throws` and inert by default, so a specimen renders the footer with no
/// terminal behind it. `async` because the port's are: a rung is WALKED a keystroke at a time
/// (#653), and the other two reach the CLI as a line typed at its prompt. The refusals are the
/// composer's seam to repeat.
package struct SessionSettingIntents {
    var setMode: (SessionMode) async throws -> Void = { _ in }
    /// By the id the CLI is asked for — an alias or a full model name, passed through untouched.
    var setModel: (String) async throws -> Void = { _ in }
    var setEffort: (SessionEffort) async throws -> Void = { _ in }

    /// Spelled out because Swift synthesises no memberwise initializer above `internal`, and the
    /// specimens build this from their own target (#1085).
    package init(
        setMode: @escaping (SessionMode) async throws -> Void = { _ in },
        setModel: @escaping (String) async throws -> Void = { _ in },
        setEffort: @escaping (SessionEffort) async throws -> Void = { _ in },
    ) {
        self.setMode = setMode
        self.setModel = setModel
        self.setEffort = setEffort
    }
}
