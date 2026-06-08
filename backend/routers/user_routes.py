"""
routers/user_routes.py — User profile & admin user management endpoints.
"""

import sqlite3
from typing import List
from fastapi import APIRouter, Depends, HTTPException

from schemas import UserPublic, UserPrivate, UserStatusUpdate, TraineeProfileOut, TraineeProfileUpdate
from dependencies import get_db, get_current_user, require_role

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserPrivate)
def get_my_profile(current_user=Depends(get_current_user)):
    return dict(current_user)

@router.get("/{anonymous_name}/status")
def get_user_status(anonymous_name: str, conn: sqlite3.Connection = Depends(get_db)):
    row = conn.execute("""
        SELECT CASE WHEN last_active >= datetime('now', '-2 minutes') THEN 1 ELSE 0 END as is_online
        FROM users WHERE anonymous_name = ?
    """, (anonymous_name,)).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    return {"is_online": bool(row["is_online"])}


@router.get("/trainees", response_model=List[TraineeProfileOut])
def list_trainees(conn: sqlite3.Connection = Depends(get_db)):
    """List all available trainees (public, no auth required for browsing)."""
    rows = conn.execute("""
        SELECT tp.user_id, u.anonymous_name, tp.specialty, tp.languages,
               tp.rating, tp.sessions_done, tp.is_available, tp.next_slot, u.gender
        FROM trainee_profiles tp
        JOIN users u ON u.id = tp.user_id
        WHERE u.status = 'Active'
        ORDER BY tp.rating DESC
    """).fetchall()
    return [dict(r) | {"is_available": bool(r["is_available"])} for r in rows]


@router.patch("/trainees/me", response_model=TraineeProfileOut)
def update_trainee_profile(
    body: TraineeProfileUpdate,
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(require_role("trainee")),
):
    user_id = current_user["id"]
    row = conn.execute("SELECT * FROM trainee_profiles WHERE user_id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Trainee profile not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return dict(row)

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(
        f"UPDATE trainee_profiles SET {set_clause}, updated_at = datetime('now') WHERE user_id = ?",
        (*updates.values(), user_id),
    )
    conn.commit()
    row = conn.execute("""
        SELECT tp.*, u.anonymous_name, u.gender
        FROM trainee_profiles tp JOIN users u ON u.id = tp.user_id
        WHERE tp.user_id = ?
    """, (user_id,)).fetchone()
    return dict(row) | {"is_available": bool(row["is_available"])}


# ── Admin: list all users ──
@router.get("/", response_model=List[UserPublic])
def list_users(
    conn: sqlite3.Connection = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    rows = conn.execute(
        "SELECT id, anonymous_name, role, status, flag_count, created_at FROM users ORDER BY created_at DESC"
    ).fetchall()
    return [dict(r) for r in rows]


# ── Admin: suspend / activate a user ──
@router.patch("/{user_id}/status", response_model=UserPublic)
def update_user_status(
    user_id: int,
    body: UserStatusUpdate,
    conn: sqlite3.Connection = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    allowed = {"Active", "Suspended", "Deactivated"}
    if body.status not in allowed:
        raise HTTPException(400, f"status must be one of {allowed}")
    conn.execute(
        "UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?",
        (body.status, user_id),
    )
    conn.commit()
    row = conn.execute(
        "SELECT id, anonymous_name, role, status, flag_count, created_at FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    return dict(row)
