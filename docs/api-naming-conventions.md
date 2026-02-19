# Unified Naming Guideline for Parallel GraphQL and REST APIs

## Purpose
Design GraphQL and REST APIs in parallel on the same backend using one shared naming model, so both channels stay consistent, scalable, and easy to maintain.

---

## 1) Shared Operation Model (single source of truth)

Each API operation should be defined with these components:

1. **Domain**: business area (e.g., User, Account, Catalog)
2. **Action**: business verb (e.g., get, create, update, delete, verify, lock)
3. **Resource**: target entity or aggregate (e.g., UserProfile, Session)
4. **Qualifier** (optional): additional specificity (e.g., List, ById, ByAccountId)
5. **Audience** (optional): consumer context (e.g., public, admin, internal, partner)

Canonical operation key:

**action + resource + qualifier**

Example:
`getUserProfileById`

---

## 2) Channel Naming Rules

### GraphQL
Use a namespaced operation name.

- Standard:
  `Namespace_actionResourceQualifier`
- Audience-specific (when needed):
  `Namespace_audience_actionResourceQualifier`

Examples:
- `User_getUserProfileById`
- `User_admin_getUserProfileById`
- `Catalog_partner_getItemList`

### REST
Use versioned, domain-based routing.

Pattern:
`/{version}/{domain}[/audience]/actionResourceQualifier`

Examples:
- `GET /v1/user/getUserProfileById/:id`
- `POST /v1/user/admin/updateUserStatus`
- `POST /v1/catalog/partner/getItemList`

---

## 3) Audience Rule (important)

Audience can be used in **both REST and GraphQL**, but only when it represents a real contract difference.

Include audience in the operation name/path when at least one of these changes:
- response shape
- required input fields
- business flow or side-effects
- filtering/scope semantics

Do **not** include audience if the only difference is authorization.  
In that case, keep one operation name and enforce access via auth/claims.

---

## 4) 1:1 Parity Between GraphQL and REST

For each capability, define one canonical key and expose it in both channels.

Example:
- Canonical key: `getUserProfileById`
- GraphQL: `User_getUserProfileById`
- REST: `/v1/user/getUserProfileById/:id`

This keeps behavior discoverable and avoids drift between API styles.

---

## 5) Shared Contract Requirements

GraphQL and REST versions of the same capability should share:

- input/output semantics
- validation rules
- error taxonomy (code/category/message key)
- authorization intent
- naming vocabulary (`ById`, `List`, `ByAccountId`, etc.)

Transport format may differ; business meaning must stay the same.

---

## 6) Controlled Exceptions

Allow exceptions only for:

- technical endpoints (health, diagnostics, webhooks)
- temporary legacy aliases
- external integration constraints

Any exception should be explicitly documented as non-standard.

---

## 7) Delivery Checklist for New Operations

1. Define canonical operation key (`actionResourceQualifier`)
2. Define whether audience is needed (contract difference test)
3. Add GraphQL operation (with namespace, optional audience)
4. Add REST route (version/domain, optional audience)
5. Reuse shared schemas/validation
6. Align auth and error mapping
7. Add parity tests for both channels

---

## Summary

Use one naming grammar for business capabilities:

**Action + Resource + Qualifier (+ Audience when contract differs)**

Then expose it consistently as:

- GraphQL: `Namespace[_audience]_ActionResourceQualifier`
- REST: `/{version}/{domain}[/audience]/ActionResourceQualifier`