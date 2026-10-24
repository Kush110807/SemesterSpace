Continue your existing SS-PREP-002 UI work; contract 1.1.0 and all callback signatures/data shapes are unchanged. A has corrected initial setup timestamp provenance in controller patch P1.

For onReplaceSetup({model}), model.snapshots[0].confirmedAt is a non-authoritative Clock-shaped placeholder required by the existing Model shape; A always replaces it with the captured transaction clock. Do not treat a caller timestamp as an imported historical confirmation. Keep the user-entered snapshot date/counts and explicit confirmed/completeToday controls. The engine still validates completed-day timing using A's stamped clock.

No restart or controller edit is needed. Return only your owned UI files against SS-PREP-002 as planned; A merges them onto the patched current source.
