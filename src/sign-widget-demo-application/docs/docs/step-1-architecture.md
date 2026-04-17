# Step 1 — Architecture Overview

## High-Level Architecture

![Architecture](/images/architecture.svg)

## Three Components

| Component | Role |
|---|---|
| **Browser** | Collects user data, renders the signature pad using inSign's JavaScript library, captures the handwritten signature on a `<canvas>`, and sends it to inSign via the embedded API. |
| **Your Backend** | Authenticates with inSign (controller auth), creates sessions with inline PDF + prefilled fields, retrieves signed documents. Returns the JWT to the browser so the inSign JS can talk directly to inSign. |
| **inSign Server** | Manages signing sessions, stores documents, processes signature data, embeds signatures into PDFs, provides the embedded JavaScript library. |

## Why Does the Backend Exist?

The inSign API requires **elevated controller authentication** (OAuth2 or Basic Auth) for session creation and document management. These are privileged credentials that **must never be exposed to the browser**. The backend acts as a trusted intermediary that:

1. Holds the inSign credentials securely
2. Creates sessions and acquires a **JWT token** for the browser
3. Returns the JWT and inSign server URL to the browser so the inSign JS can talk directly to inSign
4. Downloads signed documents on behalf of the user

## No Proxy Needed — Cookieless, JWT-Based

The inSign embedded API is **fully cookieless**. The inSign JS authenticates every XHR via a custom header `INSIGN_JWT: Bearer <token>`. No cookies are involved — which means **SameSite, Secure flags, and HTTPS are not required** for the embedded flow to work.

## CORS Requirement for Production

Since the browser talks directly to inSign (cross-origin), the inSign server must allow your origin via CORS headers. The sandbox already sends `Access-Control-Allow-Origin: *`. For production:

| Where | Setting | Value | Why |
|---|---|---|---|
| **inSign Server** | `cors.allowed.origins` | `https://your-app.com` (sandbox uses `*`) | Without this, browsers block cross-origin XHR from your app to inSign |
| **inSign Server** | `cors.allowed.headers` | `INSIGN_JWT, Content-Type, X-Requested-With` | `INSIGN_JWT` and `X-Requested-With` are non-simple headers that trigger a CORS preflight (`OPTIONS`) request. inSign must respond with these in `Access-Control-Allow-Headers`. |

> **No cookies. No SameSite. No proxy.** The inSign embedded flow is entirely JWT-header-based. The browser loads JS directly from inSign (public) and authenticates all API calls via the `INSIGN_JWT` header.

> **Pitfall:** Never call `/configure/session` or `/configure/uploaddocument` from the browser. These require elevated controller authentication (OAuth2 or Basic Auth). Only the backend should call configuration endpoints.
