import ArgoEngine

/// The standing things the composer's footer can put the shown Session on: its adapter-authored
/// Permission choice, legacy Mode rung (#545), and the CLI's own Model and Effort knobs (#558).
///
/// One value rather than separate closures on `DeckIntents`, because they are one row of controls.
/// Reset binds only Model and Effort; Permission remains independently selectable.
///
/// They stay separate and are never folded into one call: changing Model or Effort must not imply
/// a change to Permission. `setMode` remains as the internal compatibility route while adapters
/// expose their own Permission choices to the composer.
///
/// Every one is `async throws` and inert by default, so a specimen renders the footer with no
/// terminal behind it. `async` because the port's are: a rung is WALKED a keystroke at a time
/// (#653), and the other two reach the CLI as a line typed at its prompt. The refusals are the
/// composer's seam to repeat.
package struct SessionSettingIntents {
    var setPermission: (String) async throws -> Void = { _ in }
    var setMode: (SessionMode) async throws -> Void = { _ in }
    /// By the id the CLI is asked for — an alias or a full model name, passed through untouched.
    var setModel: (String) async throws -> Void = { _ in }
    var setEffort: (SessionEffort) async throws -> Void = { _ in }

    /// Spelled out because Swift synthesises no memberwise initializer above `internal`, and the
    /// specimens build this from their own target (#1085).
    package init(
        setPermission: @escaping (String) async throws -> Void = { _ in },
        setMode: @escaping (SessionMode) async throws -> Void = { _ in },
        setModel: @escaping (String) async throws -> Void = { _ in },
        setEffort: @escaping (SessionEffort) async throws -> Void = { _ in },
    ) {
        self.setPermission = setPermission
        self.setMode = setMode
        self.setModel = setModel
        self.setEffort = setEffort
    }
}
