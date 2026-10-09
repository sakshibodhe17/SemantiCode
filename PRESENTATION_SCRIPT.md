# SemantiCode — Demo Script (~5 minutes)

**Before:** open the `semanticode` folder in VS Code and press F5 once so
dependencies install. Fallback: Extensions → … → Install from VSIX →
`semanticode-1.0.0.vsix`, then open `demo-project`.

1. F5 → **Run SemantiCode Extension (demo-project)**. Status bar shows
   *SemantiCode: not indexed*.
2. SemantiCode icon → **Index Workspace** → live steps, real stats
   (6 files; Python, TypeScript, Java).
3. Search **where is the jwt token created** → `issue_token` first; open the
   preview → highlighted words + *Matched* chips.
4. Search **user signup** → `create_user` via the ≈ *register* concept
   (no shared word — the semantic part).
5. Search **how do we refund a payment** → Java `refundPayment`.
6. **Open in Editor** → exact line, range flashes.
7. **Ctrl+Alt+Shift+F** → type *retry failed http requests* → live results.
8. Select the body of `hash_password` → right-click → **Find Similar Code**
   → `check_password`.
9. Filters: `lang:java kind:class payment`.
10. Live update: add `def send_birthday_greeting(user):` with docstring
    "Wish the customer a happy birthday" to `services/orders.py`, save,
    search **birthday wishes** → found without re-indexing.
11. History and Settings screens (real VS Code settings).
12. Command Palette → **SemantiCode: Show Index Insights**.
13. Optional backend: `python -m uvicorn backend.main:app --port 8000` →
    http://127.0.0.1:8000/docs → `/health`, `/api/index`, `/api/search`;
    then Settings → Engine → FastAPI backend → re-index.
