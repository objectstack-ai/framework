---
"@objectstack/plugin-auth": patch
---

fix(auth): make the self-service "Resend Verification Email" action work

better-auth's stock `POST /send-verification-email` requires `{ email }` in the
body, but the `sys_user` `resend_verification_email` action (record-header
button, "email unverified" record alert, and record-section quick action) fires
with an empty body — so the request bounced with `[body.email] Invalid input:
expected string, received undefined` and the button was permanently broken. A
thin wrapper route now defaults the address to the authenticated caller's own
session email when the body omits it, then re-dispatches through the real route.
An explicitly-supplied `email` (admin / verify-screen path) passes through
untouched.
