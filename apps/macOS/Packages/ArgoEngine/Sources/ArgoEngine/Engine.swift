/// The engine's entry point: the one value the app owns for the lifetime of the process.
/// Empty until it has readers to hold — it exists now so the package has a public surface
/// to link against.
public struct Engine: Sendable {
    public init() {}
}
