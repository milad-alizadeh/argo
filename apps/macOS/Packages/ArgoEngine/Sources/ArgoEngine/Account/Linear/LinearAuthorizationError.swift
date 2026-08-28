import Foundation

/// Why an authorization did not produce an Account.
public enum LinearAuthorizationError: Error, Equatable {
    /// No OAuth App is registered in this build, so there is nothing to authorize as.
    case notRegistered
    /// The loopback could not be listened on — another process holds the port, most often Argo
    /// itself in another window.
    case redirectUnavailable
    /// The user closed the browser, or the wait was stopped.
    case abandoned
    /// A redirect arrived whose `state` is not the one that was sent. Refused rather than
    /// exchanged: it is a request Argo did not make.
    case stateMismatch
    /// Linear refused, in its own words — `access_denied` when the user declines, and whatever
    /// else its error body carries.
    case refused(String)
    /// Linear answered with something that is not the documented shape. Never guessed past.
    case malformedResponse
}
