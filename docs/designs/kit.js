/*
 * Shared study kit (rules/design-studies.md). Recurring atoms/molecules live
 * here as named render functions — one explicit props object in, an HTML string
 * out, a stable data-component="PascalCaseName" on the root. A study
 * script-includes this file and calls the functions; it never re-writes their
 * markup. New primitive → add it here first, then compose.
 *
 * Grows as studies repeat shapes — currently only the escape helper.
 */

/** Escape untrusted text before interpolating it into an HTML string. */
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
