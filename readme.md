<p align="center">
  <a href="https://www.getinsign.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./docs/img/inSign_logo_white.svg" />
      <img src="./docs/img/inSign_logo.svg" width="225" alt="inSign - Simple signature processes" />
    </picture>
  </a>
</p>

<h1 align="center">inSign for Developers</h1>

<p align="center">
  <strong>Add electronic signatures to your application.</strong><br>
  <sub>EU-hosted. eIDAS-compliant. Free sandbox - no registration, no API key, no credit card.</sub>
</p>

---

## What is inSign?

**inSign** is a cloud-based electronic signature platform. It lets you integrate legally binding signatures (simple, advanced, and qualified) into any application via a REST API. Documents are processed and stored on EU infrastructure. The free sandbox gives you full API access with zero setup.

## Where to start?

### New here? Start with the Getting Started Guide

> **[Open the Getting Started Guide](https://getinsign.github.io/insign-getting-started/guide.html)**

Interactive 4-step walkthrough. Create a session, upload a PDF, sign it, download the result - all live in your browser against the free sandbox. Takes about 5 minutes.

### Want to explore the full API? Use the API Explorer

> **[Open the API Explorer](https://getinsign.github.io/insign-getting-started/explorer.html)**

Full interactive playground with a schema-aware JSON editor, autocomplete from the live OpenAPI spec, code snippets in 13 languages, webhook visualization, and request tracing. This is your API reference.

### Want to see a working integration? Check the demo apps

| Demo | What it shows | Stack |
|------|--------------|-------|
| **[Embedded Signature Pad](src/sign-widget-demo-application/)** | SEPA mandate signing with inline signature pad, JWT auth, dynamic PDF generation | Node.js, Express |
| **[Java Sample App](src/java/)** | Full backend: session management, document upload, webhooks, SSE events, pluggable API clients | Java, Spring Boot |

Both connect to the free sandbox out of the box. Clone, run, adapt.

---

## Overview: What's in this repository?

| Component | Description | For whom |
|-----------|-------------|----------|
| [**Developer Hub**](https://getinsign.github.io/insign-getting-started/) | Landing page with guided paths | Everyone |
| [**Getting Started Guide**](https://getinsign.github.io/insign-getting-started/guide.html) | 4-step interactive API walkthrough | New to inSign |
| [**API Explorer**](https://getinsign.github.io/insign-getting-started/explorer.html) | Interactive playground, code generation, API reference | All developers |
| [**Signature Pad Demo**](src/sign-widget-demo-application/) | Embedded signature pad in a SEPA mandate flow | Frontend / fullstack |
| [**Java Sample App**](src/java/) | Spring Boot backend with pluggable API clients | Backend / Java |
| **Postman Collection** | Pre-built requests for the sandbox ([collection](docs/data/Getting%20started%20with%20inSign%20API%20Sandbox.postman_collection.json), [environment](docs/data/inSign%20environment%20sandbox.postman_environment.json)) | Quick API testing |

---

## Quick Start: Embedded Signature Pad (Node.js)

```bash
cd src/sign-widget-demo-application
./run.sh              # installs deps, starts the server
# Open http://localhost:3000
```

The form is prefilled with test data - click through the entire signing flow immediately. Also deployable to [Glitch](https://glitch.com/), [StackBlitz](https://stackblitz.com/), [Vercel](https://vercel.com/), or Docker. See the [demo README](src/sign-widget-demo-application/README.md).

## Quick Start: Java Spring Boot

```bash
cd src/java/app
mvn spring-boot:run -Pspring-client    # or: -Pinsign-client
# Open http://localhost:8090
```

Pluggable API client architecture - swap between the Spring REST client and the Java API client by changing one Maven profile. See the [Java README](src/java/README.md).

---

## Project Structure

```
docs/                                  Developer hub (GitHub Pages)
  index.html                           Landing page & overview
  guide.html                           Getting Started guide
  explorer.html                        API Explorer
  js/                                  Application modules
  codegen-templates/                   Code snippets (13 variants, 11 languages)
  data/                                Test PDFs, Postman collections
src/
  sign-widget-demo-application/        Embedded signature pad demo (Node.js)
  java/                                Spring Boot sample application
```

---

<p align="center">
  <a href="https://github.com/getinsign/insign-getting-started/actions/workflows/maven.yml"><img src="https://img.shields.io/github/actions/workflow/status/getinsign/insign-getting-started/maven.yml?branch=main&label=Java%20%28spring-client%29&logo=github" alt="Java (spring-client)" /></a> <a href="https://github.com/getinsign/insign-getting-started/actions/workflows/maven.yml"><img src="https://img.shields.io/github/actions/workflow/status/getinsign/insign-getting-started/maven.yml?branch=main&label=Java%20%28insign-client%29&logo=github" alt="Java (insign-client)" /></a> <a href="https://github.com/getinsign/insign-getting-started/actions/workflows/node.yml"><img src="https://img.shields.io/github/actions/workflow/status/getinsign/insign-getting-started/node.yml?branch=main&label=Sign%20Widget%20Tests&logo=github" alt="Sign Widget Tests" /></a> <a href="https://github.com/getinsign/insign-getting-started/actions/workflows/node.yml"><img src="https://img.shields.io/github/actions/workflow/status/getinsign/insign-getting-started/node.yml?branch=main&label=UI%20Integration%20Tests&logo=github" alt="UI Integration Tests" /></a>
</p>

<p align="center">
  <a href="https://www.linkedin.com/company/insign-gmbh/"><img src="https://img.shields.io/badge/LinkedIn-insign--gmbh-0A66C2?logo=linkedin&logoColor=white" alt="LinkedIn" /></a>
  <a href="https://www.getinsign.com/"><img src="https://img.shields.io/badge/Web-getinsign.com-0165bc?logo=googlechrome&logoColor=white" alt="getinsign.com" /></a>
  <a href="https://www.getinsign.de/"><img src="https://img.shields.io/badge/Web-getinsign.de-0165bc?logo=googlechrome&logoColor=white" alt="getinsign.de" /></a>
</p>

<p align="center">
  <strong><a href="https://www.getinsign.com/">inSign GmbH</a></strong> - Simple signature processes<br>
  <sub><a href="https://www.getinsign.de/impressum/">Impressum</a> &middot; <a href="https://www.getinsign.de/datenschutz/">Datenschutz</a></sub>
</p>
