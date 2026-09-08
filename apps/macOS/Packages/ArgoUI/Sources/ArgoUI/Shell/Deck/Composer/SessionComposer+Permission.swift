extension SessionComposer {
    /// Return an adapter-authored permission id without interpreting it in presentation.
    func askForPermission(_ id: String) {
        Task {
            do {
                try await intents.settings.setPermission(id)
                draft.say(nil)
            } catch {
                draft.modeRefused(error)
            }
        }
    }
}
