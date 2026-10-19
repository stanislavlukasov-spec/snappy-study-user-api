# Snappy Study User API – Notes

Date: 2026-04-14

## Auth & Account Model

- Main (parent) account:
  - Auth via AWS Cognito User Pool.
  - Google sign-in federated into the same user pool (planned, not wired yet).
- Child accounts:
  - Up to 4 children per parent.
  - Created by the parent (not self-signup).
  - Linked to the app using a QR code flow.

## API Endpoints (current design)

- `GET /me`
  - Auth: parent token (Cognito; currently stubbed).
  - Returns parent profile + list of linked children.

- `POST /children`
  - Auth: parent.
  - Body: `{ displayName: string }`.
  - Creates a child account under the parent (max 4 children).

- `POST /children/{childId}/qr`
  - Auth: parent.
  - Generates a QR token for a specific child.
  - Current stub format: `qr:<parentId>:<childId>:<timestamp>`.

- `POST /child-session/qr`
  - Auth: none (called from kid's device after scanning QR).
  - Body: `{ qrToken: string }`.
  - Validates QR token and returns a child session token plus child info.
  - Current stub child token: `child-<childId>:<parentId>`.

- `GET /child/me`
  - Auth: child token.
  - Returns child profile + parent id.

## AWS Architecture (template.yaml)

- HTTP API (ApiGatewayV2::Api) with separate routes and integrations:
  - `ParentMeLambda` – `GET /me`
  - `CreateChildLambda` – `POST /children`
  - `GenerateChildQrLambda` – `POST /children/{childId}/qr`
  - `ChildSessionFromQrLambda` – `POST /child-session/qr`
  - `ChildMeLambda` – `GET /child/me`
- All Lambdas share:
  - Runtime: `nodejs18.x`.
  - Same IAM role (`UserApiLambdaRole`).
  - VPC config (UserVpc + subnets + SG).
  - DB env vars: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

## Code Structure (target / partial)

Intended layout in this repo:

- `src/shared/`
  - `auth.js` – parent/child auth helpers (currently stubbed; later Cognito + JWT).
  - `store.js` – in-memory parent/child store (will be replaced by DB access using `mysql2`).
  - `http.js` – helpers for JSON responses and body parsing.

- `src/domain/parent/`
  - `getMe.js` – implements parent `/me` logic.
  - `createChild.js` – implements child creation + max 4 children rule.
  - `generateChildQr.js` – creates QR tokens for children.

- `src/domain/child/`
  - `sessionFromQr.js` – exchanges QR token for child session token.
  - `getMe.js` – returns child profile + parent id.

- `src/handlers/`
  - `parentMe.js` – Lambda handler for `GET /me`.
  - `createChild.js` – Lambda handler for `POST /children`.
  - `generateChildQr.js` – Lambda handler for `POST /children/{childId}/qr`.
  - `childSessionFromQr.js` – Lambda handler for `POST /child-session/qr`.
  - `childMe.js` – Lambda handler for `GET /child/me`.

## Environment / Path Caveat

- There is both an OpenClaw workspace and the real user Documents folder:
  - OpenClaw workspace: `/Users/jarvis/.openclaw/workspace/...`
  - Real project (this repo): `/Users/jarvis/Documents/snappy-study-user-api`.
- Some earlier edits landed in the OpenClaw workspace mirror; the **source of truth** should be this real Documents repo.
- When changing files going forward, always confirm the path is under:
  - `/Users/jarvis/Documents/snappy-study-user-api` (real project)