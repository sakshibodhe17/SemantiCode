// Static sample results (snapshot of this repo's backend/ code).
// Used ONLY by the browser preview host (src/devHost.ts) when the UI runs
// outside VS Code (npm run dev / UI tests). Inside VS Code every result
// comes from the real index built by the extension host.

export interface GeneratedSearchEntry {
  id: string;
  name: string;
  className: string | null;
  file: string;
  startLine: number;
  endLine: number;
  tags: string[];
  baseScore: number;
  code: string[];
}

export const generatedSearchEntries: GeneratedSearchEntry[] = [
  {
    "id": "authenticate-user",
    "name": "authenticate_user",
    "className": null,
    "file": "backend/auth/service.py",
    "startLine": 30,
    "endLine": 47,
    "tags": [
      "jwt",
      "authentication",
      "auth",
      "login",
      "authenticate",
      "user",
      "password",
      "token",
      "credential",
      "verify"
    ],
    "baseScore": 94.21,
    "code": [
      "def authenticate_user(username: str, password: str):",
      "    \"\"\"",
      "    Authenticate a user by username and password.",
      "",
      "    Looks the user up in the database, verifies the supplied password",
      "    against the stored hash, and \u2014 if valid \u2014 issues a signed JWT access",
      "    token. Returns None when authentication fails so callers can respond",
      "    with a generic 401 rather than leaking which check failed.",
      "    \"\"\"",
      "    user = get_user(username)",
      "",
      "    if user and verify_password(",
      "        password,",
      "        user.password_hash",
      "    ):",
      "        return create_access_token(user)",
      "",
      "    return None"
    ]
  },
  {
    "id": "verify-token",
    "name": "verify_token",
    "className": null,
    "file": "backend/auth/jwt.py",
    "startLine": 31,
    "endLine": 44,
    "tags": [
      "jwt",
      "token",
      "verify",
      "validate",
      "authentication",
      "decode",
      "expired",
      "signature"
    ],
    "baseScore": 89.73,
    "code": [
      "def verify_token(token: str) -> dict | None:",
      "    \"\"\"",
      "    Decode and validate a JWT access token.",
      "",
      "    Returns the decoded claims when the token is well-formed, correctly",
      "    signed, and not expired. Returns None for any failure so the caller",
      "    can uniformly respond with 401 Unauthorized.",
      "    \"\"\"",
      "    try:",
      "        return pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])",
      "    except pyjwt.ExpiredSignatureError:",
      "        return None",
      "    except pyjwt.InvalidTokenError:",
      "        return None"
    ]
  },
  {
    "id": "create-access-token",
    "name": "create_access_token",
    "className": null,
    "file": "backend/auth/jwt.py",
    "startLine": 19,
    "endLine": 27,
    "tags": [
      "jwt",
      "token",
      "generate",
      "create",
      "access",
      "sign",
      "authentication",
      "issue"
    ],
    "baseScore": 87.05,
    "code": [
      "def create_access_token(user, expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:",
      "    \"\"\"Create a signed JWT access token for an authenticated user.\"\"\"",
      "    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)",
      "    payload = {",
      "        \"sub\": str(user.id),",
      "        \"username\": user.username,",
      "        \"role\": user.role,",
      "        \"exp\": expire,",
      "    }"
    ]
  },
  {
    "id": "login-route",
    "name": "login",
    "className": null,
    "file": "backend/routes/auth.py",
    "startLine": 18,
    "endLine": 37,
    "tags": [
      "login",
      "route",
      "endpoint",
      "authentication",
      "jwt",
      "api",
      "http",
      "post"
    ],
    "baseScore": 84.12,
    "code": [
      "def login(payload: LoginRequest):",
      "    \"\"\"",
      "    Authenticate a user and return a JWT access token.",
      "",
      "    This is the endpoint the frontend calls when a user submits the",
      "    login form. On success it returns a bearer token; on failure it",
      "    returns 401 without indicating whether the username or password",
      "    was wrong.",
      "    \"\"\"",
      "    token = authenticate_user(payload.username, payload.password)",
      "    record_login_attempt(payload.username, success=token is not None)",
      "",
      "    if token is None:",
      "        raise HTTPException(",
      "            status_code=status.HTTP_401_UNAUTHORIZED,",
      "            detail=\"Invalid username or password\",",
      "        )",
      "",
      "    return LoginResponse(access_token=token, token_type=\"bearer\")",
      ""
    ]
  },
  {
    "id": "get-db-session",
    "name": "get_db_session",
    "className": null,
    "file": "backend/db/connection.py",
    "startLine": 26,
    "endLine": 44,
    "tags": [
      "database",
      "db",
      "connection",
      "session",
      "postgresql",
      "sqlalchemy",
      "engine",
      "create"
    ],
    "baseScore": 91.5,
    "code": [
      "def get_db_session():",
      "    \"\"\"",
      "    Provide a transactional database session as a context manager.",
      "",
      "    Usage:",
      "        with get_db_session() as session:",
      "            session.query(User).all()",
      "",
      "    The session is always closed on exit, and any uncommitted changes",
      "    are rolled back if an exception propagates out of the block.",
      "    \"\"\"",
      "    session = SessionLocal()",
      "    try:",
      "        yield session",
      "    except Exception:",
      "        session.rollback()",
      "        raise",
      "    finally:",
      "        session.close()"
    ]
  },
  {
    "id": "check-connection",
    "name": "check_connection",
    "className": null,
    "file": "backend/db/connection.py",
    "startLine": 47,
    "endLine": 54,
    "tags": [
      "database",
      "connection",
      "health",
      "check",
      "ping"
    ],
    "baseScore": 76.8,
    "code": [
      "def check_connection() -> bool:",
      "    \"\"\"Ping the database to confirm connectivity (used by health checks).\"\"\"",
      "    try:",
      "        with engine.connect() as conn:",
      "            conn.execute(\"SELECT 1\")",
      "        return True",
      "    except Exception:",
      "        return False"
    ]
  },
  {
    "id": "save-upload",
    "name": "save_upload",
    "className": null,
    "file": "backend/uploads/handler.py",
    "startLine": 30,
    "endLine": 48,
    "tags": [
      "upload",
      "file",
      "save",
      "storage",
      "validation",
      "write"
    ],
    "baseScore": 92.6,
    "code": [
      "def save_upload(filename: str, content: bytes) -> str:",
      "    \"\"\"",
      "    Validate and save an uploaded file to disk.",
      "",
      "    Returns the generated storage path. Files are stored under a random",
      "    UUID-derived name so user-supplied filenames never collide or allow",
      "    path traversal.",
      "    \"\"\"",
      "    validate_upload(filename, len(content))",
      "",
      "    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)",
      "    extension = Path(filename).suffix.lower()",
      "    stored_name = f\"{uuid.uuid4().hex}{extension}\"",
      "    destination = UPLOAD_DIR / stored_name",
      "",
      "    with open(destination, \"wb\") as f:",
      "        f.write(content)",
      "",
      "    return str(destination)"
    ]
  },
  {
    "id": "validate-upload",
    "name": "validate_upload",
    "className": null,
    "file": "backend/uploads/handler.py",
    "startLine": 19,
    "endLine": 27,
    "tags": [
      "upload",
      "validation",
      "file",
      "extension",
      "size",
      "check"
    ],
    "baseScore": 88.4,
    "code": [
      "def validate_upload(filename: str, size_bytes: int) -> None:",
      "    \"\"\"Raise ValueError if the upload fails basic validation checks.\"\"\"",
      "    extension = Path(filename).suffix.lower()",
      "",
      "    if extension not in ALLOWED_EXTENSIONS:",
      "        raise ValueError(f\"Unsupported file type: {extension}\")",
      "",
      "    if size_bytes > MAX_UPLOAD_SIZE_BYTES:",
      "        raise ValueError(\"File exceeds maximum upload size of 50MB\")"
    ]
  },
  {
    "id": "get-by-username",
    "name": "get_by_username",
    "className": "UserRepository",
    "file": "backend/db/repository.py",
    "startLine": 17,
    "endLine": 24,
    "tags": [
      "user",
      "repository",
      "database",
      "query",
      "lookup",
      "username",
      "find"
    ],
    "baseScore": 82.9,
    "code": [
      "    def get_by_username(self, username: str) -> User | None:",
      "        \"\"\"Look up a single user by username.\"\"\"",
      "        with get_db_session() as session:",
      "            return (",
      "                session.query(User)",
      "                .filter(User.username == username)",
      "                .first()",
      "            )"
    ]
  }
];
