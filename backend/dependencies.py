"""
dependencies.py — FastAPI dependency injection helpers.
"""

import sqlite3
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from database import get_connection
from auth import decode_token, oauth2_scheme


def get_db():
    """Provide a SQLite connection; close it after the request."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    conn: sqlite3.Connection = Depends(get_db),
):
    """Decode the JWT and return the current user row."""
    payload = decode_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = conn.execute("SELECT * FROM users WHERE id = ?", (int(user_id),)).fetchone()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if user["status"] == "Suspended":
        raise HTTPException(status_code=403, detail="Account suspended")

    conn.execute("UPDATE users SET last_active = datetime('now') WHERE id = ?", (int(user_id),))
    conn.commit()

    return user


def require_role(*roles):
    """Factory that produces a dependency enforcing role membership."""
    def _check(current_user=Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return _check
