import Foundation

/// One plugin install a Project can reach: the key it is switched on or off by, the plugin's own
/// name, and where the skills it carries were unpacked.
struct PluginInstall: Equatable {
    /// `plugin@marketplace`, which is how both the install record and the settings name it.
    let key: String
    /// The part before the marketplace, which is what the CLI answers to in a command.
    let plugin: String
    let skillsURL: URL
}
