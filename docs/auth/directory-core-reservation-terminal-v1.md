# Directory capacity: terminal reservation clarification

Status: public pre-code amendment. This supplements [the directory contract](directory-core-v1.md)
and [transaction outcome amendment](directory-core-transaction-outcome-v1.md). It changes no
funding authority, public API shape, command horizon or real-adapter admission.

A successful reserveGrowth result must never treat a released reservation as a funded
hold. For an exact existing namespace/command/digest/account/quote/class binding:

- held returns its same reservation ID idempotently, without another funding effect;
- released is terminal and reserveGrowth refuses with a safe failure, leaving it released;
- settled may identify only the same already-committed allocation for dedupe/reconciliation,
  without another funding effect. It cannot authorize new growth. The directory must
  observe the existing matching command receipt in its serialized directory transaction
  and return replay; no additional
  identity/revision/consent/event changes may be committed under that settled allocation.

After an authoritative confirmed abort, the host may issue a NEW command with fresh
command-bound approval/consent, quote and funded admission within current authority.
The old command cannot be silently rearmed. After an unknown transaction, absence,
timeout or expiry is not abort evidence and cannot authorize a replacement command/send.
Current qualified reconciliation remains mandatory.

Settlement/release/reconciliation must preserve exact reservationId and commandId.
held -> settled and held -> released are the only first terminal transitions. Repeating
the same terminal transition is idempotent. settled -> released and released -> settled
refuse unchanged; unknown reconciliation outcomes or wrong bindings refuse unchanged.
The synthetic host fixture models these transitions only. Error messages/tags from this
fixture create no actual rollback or funding evidence; the directory sanitizes failures
using its closed error contract. Real durable atomic reservation/funding/terminal-state
and crash reconciliation evidence remains mandatory DIR-I03.

The bounded oracle must directly falsify released same-command reuse, invalid terminal
cross-transitions and wrong binding. Its candidate-facing T37 must attempt that same
command after a confirmed abort and assert safe denial, no directory growth, no new
funding effect and the original released state. A later fresh, authorized command may
succeed only after actual admission. These are local modeled effects, not an h24 or
physical cost proof. Both acceptance authors remain separate from the future production
directory implementation executor.
