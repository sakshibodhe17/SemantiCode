# demo-project — sample codebase for the SemantiCode demo

A small, multi-language "online shop" used to demonstrate SemantiCode during
the viva. It is NOT part of SemantiCode itself — it plays the role of a
developer's project open in VS Code.

| Folder | Language | What lives there |
|---|---|---|
| `api/` | Python | login / JWT, user registration, password hashing, DB session |
| `services/` | Python | order placement, inventory, email notifications |
| `web/src/` | TypeScript | cart UI logic, API client with retry |
| `payments/` | Java | card charge, refunds, webhook signature check |

Good demo queries:
- *where is the jwt token created*
- *how are passwords hashed*
- *where is the cart total calculated*
- *how do we refund a payment*
- *retry failed http requests*
- *send email when an order ships*
- *lang:java kind:class payment*
