# Security Policy

## Reporting a vulnerability

Do not open public GitHub issues for security vulnerabilities.

Report suspected vulnerabilities privately to the maintainers with:

- affected version or commit
- impact summary
- reproduction steps or proof of concept
- any suggested mitigation

Use the private contact path documented in `SUPPORT.md`.

## Scope notes

- Demo credentials, demo server configuration, and local `.env.local` usage are for development only and must not be reused in production environments.
- The demo Vite proxy and Basic Auth flow are not a recommended production security model.

## Response goals

- acknowledge receipt within a reasonable time
- validate and triage impact
- prepare a fix or mitigation
- disclose publicly after a fix is available when appropriate