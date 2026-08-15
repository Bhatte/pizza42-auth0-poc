# Contributing

This is a small interview POC, but changes should still be easy to review and explain.

## Workflow

1. Create a short-lived branch from `main`.
2. Keep the change focused on one vertical slice.
3. Add or update tests with the implementation.
4. Run the relevant local checks.
5. Open a pull request and record what was tested.
6. Squash-merge after review and delete the branch.

Use conventional commit prefixes where they add clarity: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, or `ci`.

## Pull request standard

A pull request should explain:

- the customer or technical problem;
- the behaviour that changed;
- the security impact, if any;
- the checks that were run;
- any new limitation or production difference.

Do not commit credentials, tenant secrets, real customer data, panel material, screenshots containing tokens, or copied internal documents. Use `.env.example` files with safe placeholders.

## Definition of done

A change is done when the code, tests, and documentation agree. Security controls must be enforced at the API boundary and demonstrated with a failure case as well as a happy path.
