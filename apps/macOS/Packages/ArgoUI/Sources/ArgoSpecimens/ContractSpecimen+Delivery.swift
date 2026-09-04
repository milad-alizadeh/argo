import ArgoAtoms
import ArgoDesign
import ArgoUI
import SwiftUI

/// The two families the roster row's third line is made of, on the sheet before any surface draws
/// them (#1341). Nothing reflected can put them here — `delivery.all` and `progress.all` are
/// catalogues, and a catalogue says a role's name, not the shape it is spent in — so both are
/// drawn by hand, each in the shape the row will spend it in.
extension ContractSpecimen {
    /// Borrowed inks, so what has to be judged is whether the borrowing landed: green and purple
    /// on THIS deck, at the size an address is really set at, with the running teal and the two
    /// diff inks a scroll away on the same sheet.
    var delivery: some View {
        section("Delivery — the code host's own two, at the size an address is set at") {
            VStack(alignment: .leading, spacing: ArgoSpacing.snug) {
                ForEach(argo.color.delivery.all, id: \.name) { role in
                    HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
                        label(role.name)
                        HStack(spacing: ArgoSpacing.tight) {
                            ArgoGlyph(ArgoSymbol.branch, ArgoIconSize.inline)
                            Text("#1291").argoText(ArgoTypography.machine)
                        }
                        .foregroundStyle(role.color)
                        unwired("#1346")
                    }
                }
            }
        }
    }

    /// One list at three readings, stacked so the judgement is the only one that matters: whether
    /// the banked rung still says HOW FAR the work got when it is no longer moving.
    var progress: some View {
        section("Progress — the accent, banked; never a state, and never the disabled rung") {
            VStack(alignment: .leading, spacing: ArgoSpacing.snug) {
                plan("moving", done: argo.color.interaction.accent, note: "#1345")
                plan("still", done: argo.color.progress.still, note: "#1345")
                // The rung this role exists to not be. A plan drawn here reads as one nobody
                // started, which is the whole reason `progress.still` is its own value.
                plan("not text.disabled", done: argo.color.text.disabled, note: nil)
            }
        }
    }

    /// A Plan as the row draws it: one segment per to-do item, done ones in `done` and the rest in
    /// the ground they are cut out of.
    private func plan(_ name: String, done: ArgoColor, note: String?) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.loose) {
            label(name)
            HStack(spacing: ArgoSpacing.tight) {
                ForEach(0 ..< 5, id: \.self) { index in
                    RoundedRectangle(cornerRadius: ArgoRadius.marker)
                        .fill(index < 3 ? done : argo.color.surface.raised)
                        .frame(width: 18, height: 6)
                }
            }
            unwired(note)
        }
    }
}
