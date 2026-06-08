"""
routers/auth_routes.py — Register & Login endpoints.
"""

import sqlite3
from fastapi import APIRouter, Depends, HTTPException, status

from schemas import RegisterRequest, LoginRequest, TokenResponse
from auth import hash_password, verify_password, create_access_token
from dependencies import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, conn: sqlite3.Connection = Depends(get_db)):
    # Check email uniqueness
    if conn.execute("SELECT id FROM users WHERE email = ?", (body.email,)).fetchone():
        raise HTTPException(status_code=409, detail="Email already registered")
    # Check anonymous_name uniqueness
    if conn.execute("SELECT id FROM users WHERE anonymous_name = ?", (body.anonymous_name,)).fetchone():
        raise HTTPException(status_code=409, detail="Anonymous name already taken — choose another")

    pw_hash = hash_password(body.password)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO users (real_name, email, phone, gender, anonymous_name, password_hash, role)
        VALUES (?, ?, ?, ?, ?, ?, 'student')
    """, (body.real_name, body.email, body.phone, body.gender, body.anonymous_name, pw_hash))
    user_id = cur.lastrowid
    conn.commit()

    token = create_access_token({"sub": str(user_id), "role": "student"})
    return TokenResponse(access_token=token, role="student", anonymous_name=body.anonymous_name, user_id=user_id)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, conn: sqlite3.Connection = Depends(get_db)):
    user = conn.execute("SELECT * FROM users WHERE email = ?", (body.email,)).fetchone()
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user["status"] == "Suspended":
        raise HTTPException(status_code=403, detail="Account suspended. Contact admin.")

    token = create_access_token({"sub": str(user["id"]), "role": user["role"]})
    return TokenResponse(
        access_token=token,
        role=user["role"],
        anonymous_name=user["anonymous_name"],
        user_id=user["id"],
    )
