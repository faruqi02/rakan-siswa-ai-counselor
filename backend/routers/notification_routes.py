"""
routers/notification_routes.py — In-app notification endpoints.
"""

import sqlite3
from typing import List
from fastapi import APIRouter, Depends

from schemas import NotificationOut
from dependencies import get_db, get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=List[NotificationOut])
def list_notifications(
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = conn.execute("""
        SELECT id, icon, message, is_read, link_type, link_id, created_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    """, (current_user["id"],)).fetchall()
    return [dict(r) | {"is_read": bool(r["is_read"])} for r in rows]


@router.patch("/{notif_id}/read", status_code=204)
def mark_read(
    notif_id: int,
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(get_current_user),
):
    conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
        (notif_id, current_user["id"]),
    )
    conn.commit()


@router.patch("/read-all", status_code=204)
def mark_all_read(
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(get_current_user),
):
    conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
        (current_user["id"],),
    )
    conn.commit()
