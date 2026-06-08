"""
routers/mood_routes.py — Mood logging endpoints for students.
"""

import sqlite3
from typing import List
from fastapi import APIRouter, Depends

from schemas import MoodLogCreate, MoodLogOut
from dependencies import get_db, get_current_user, require_role

router = APIRouter(prefix="/mood", tags=["Mood"])


@router.get("/", response_model=List[MoodLogOut])
def get_my_mood_logs(
    limit: int = 30,
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    rows = conn.execute("""
        SELECT id, user_id, mood, emoji, note, logged_date, created_at
        FROM mood_logs
        WHERE user_id = ?
        ORDER BY logged_date DESC
        LIMIT ?
    """, (current_user["id"], limit)).fetchall()
    return [dict(r) for r in rows]


@router.post("/", response_model=MoodLogOut, status_code=201)
def log_mood(
    body: MoodLogCreate,
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    logged_date = body.logged_date or "date('now')"
    # Use parameterized date if provided, otherwise SQL default
    if body.logged_date:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO mood_logs (user_id, mood, emoji, note, logged_date)
            VALUES (?, ?, ?, ?, ?)
        """, (current_user["id"], body.mood, body.emoji, body.note, body.logged_date))
    else:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO mood_logs (user_id, mood, emoji, note, logged_date)
            VALUES (?, ?, ?, ?, date('now'))
        """, (current_user["id"], body.mood, body.emoji, body.note))

    log_id = cur.lastrowid
    conn.commit()

    row = conn.execute("SELECT * FROM mood_logs WHERE id = ?", (log_id,)).fetchone()
    return dict(row)
