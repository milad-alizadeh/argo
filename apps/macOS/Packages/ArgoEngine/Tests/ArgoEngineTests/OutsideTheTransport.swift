/// An error raised by Argo's own code rather than by a provider or the network — the shape the
/// health vocabulary has no word for (#1698).
enum OutsideTheTransport: Error {
    case raised
}
