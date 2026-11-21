# Security

This repository is a local, mock-data demonstration and is not ready for public production deployment.

- Never commit `.env`, API tokens, Instagram session cookies, real user exports, or database backups.
- `.env.example` and Docker Compose contain local-only example credentials. Replace them before any deployment.
- Demo authentication and its published demo password are for local use only.
- Before production, resolve dependency audit findings, enforce internal invitation-only authentication, configure strong secrets and least-privilege database access, and verify deletion, backups, rate limits and cost controls.
- External data and campaign AI integrations are incomplete; see `docs/PRODUCT_PLAN.md` and `docs/CAMPAIGNS.md`.
- Do not post credentials or real user data in public issues. Report sensitive findings privately to the repository maintainers.
