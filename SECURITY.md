# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Send the repository owner a private report through GitHub Security Advisories with:

- the affected path or endpoint;
- reproduction steps;
- the impact you observed;
- any suggested mitigation.

Do not include live access tokens, client secrets, passwords, or personal data in the report.

## Scope

This repository is a proof of concept. The documented limitations are not automatically security vulnerabilities, but undocumented ways to bypass token validation, scope checks, verified-email enforcement, server-side pricing, or user isolation are in scope.

Secrets found in Git history must be revoked and rotated. Removing the file alone is not sufficient.

