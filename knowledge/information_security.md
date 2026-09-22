# Information Security Policy

## Purpose
This policy establishes baseline requirements for protecting confidential information and technology used by the CloudFin demonstration environment.

## Scope
It applies to user accounts, endpoints, application secrets, policy documents, cloud services, and administrative access.

## Definitions
**Confidential information** is non-public information requiring protection. **Least privilege** means granting only the access necessary for an approved task. **Secret** includes API keys, passwords, and private credentials.

## Procedures
Users must authenticate through approved identity services. Administrative access should be restricted to authorized roles. Secrets must be stored in environment variables or approved secret-management facilities rather than source code. Access should be revoked when no longer needed.

## Requirements
Passwords must not be stored by the CloudFin backend. Gemini API keys must never be sent to browser code. Production CORS should be restricted to the deployed frontend domain. Source repositories must exclude local .env files and other secrets.

## Responsibilities
Users protect their credentials. Developers secure application configuration. Administrators manage access. Security or designated owners investigate suspected compromise.

## Escalation and Exceptions
Lost credentials, exposed secrets, suspected account takeover, unauthorized data access, or material security weaknesses must be reported promptly. A compromised secret must be rotated rather than merely hidden.
