# Product

## Register

product

## Users

Pizza 42 customers order from a phone or laptop, often at peak dinner times when patience is low. New customers need to understand why email verification affects ordering without feeling locked out of the application. Returning customers expect sign-in, menu selection, checkout and order history to feel familiar and quick.

The second audience is the Pizza 42 technical and product team evaluating the proof of concept. The interface must make identity state, API enforcement and production trade-offs visible without turning the customer journey into a developer console.

## Product Purpose

The product proves that Pizza 42 can move customer identity to Auth0 while preserving a low-friction ordering flow. Success means a customer can authenticate through database or social login, browse the menu, understand verification state, place an authorized order and see the resulting history. The demonstration must also make direct API failure paths and trust boundaries easy to explain.

## Brand Personality

Warm, assured, straightforward.

The product should feel like a well-run neighbourhood counter during a busy evening: welcoming to customers, calm under pressure and precise about the order. Security language is plain and useful. Technical detail is available when requested but does not dominate the ordering task.

## Anti-references

- A dark cyber-security dashboard with neon accents, token rain or hacker imagery.
- A generic fast-food template built from bright red and yellow promotional panels.
- A SaaS landing page made from repeated icon cards, gradient text and inflated claims.
- A developer demo that exposes raw tokens by default or treats decoded claims as decoration.
- A checkout flow that hides errors in toasts or disables actions without explaining recovery.

## Design Principles

1. Ordering remains the primary task. Identity controls should reduce uncertainty, not add ceremony.
2. Show the trust boundary. When the API rejects an action, explain the state and the safe next step.
3. Earn confidence with specifics. Display authoritative totals, verification state and testable outcomes without security theatre.
4. Keep the POC honest. Label simulated integrations and make production differences easy to find.
5. Design failure paths as carefully as the happy path.

## Accessibility & Inclusion

Target WCAG 2.2 AA. All interactive controls need visible keyboard focus, semantic labels, 44 by 44 CSS pixel touch targets where practical, and complete keyboard operation. Meaning cannot depend on color alone. Respect `prefers-reduced-motion`, support browser zoom to 200 percent, and keep essential ordering actions usable at 320 CSS pixels without horizontal scrolling.
