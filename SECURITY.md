# Security

Do not commit credentials, `.env`, local `.data` state or real buyer data. Use short-lived AWS credentials and the deployed Lambda IAM role. Live messaging is disabled by default, and the demo cannot send to real contacts.

For a security finding, avoid publishing credentials or personal data in an issue. Use GitHub's private vulnerability reporting if enabled, or contact the repository owner through their published profile. Include a minimal synthetic reproduction, expected behavior and observed impact.

The automated tests and internal review are not an external security audit. Before customer use, validate tenant isolation, recovery procedures, provider account settings, consent and retention requirements in the deployment. Operational boundaries and known limits are documented in `docs/API_AND_SECURITY.md` and `docs/REVIEW.md`.
