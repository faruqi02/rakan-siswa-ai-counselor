"""
routers/chat_routes.py — Peer chat thread and message endpoints.
"""

import sqlite3
from typing import List
from fastapi import APIRouter, Depends, HTTPException

from schemas import ChatThreadOut, MessageCreate, MessageOut
from dependencies import get_db, get_current_user

router = APIRouter(prefix="/chats", tags=["Chat"])


def _thread_out(row, current_user_id: int, conn: sqlite3.Connection) -> dict:
    """Build a ChatThreadOut dict, resolving the partner's anonymous name."""
    partner_id = row["user_b_id"] if row["user_a_id"] == current_user_id else row["user_a_id"]
    partner = conn.execute(
        "SELECT anonymous_name FROM users WHERE id = ?", (partner_id,)
    ).fetchone()
    unread = conn.execute("""
        SELECT COUNT(*) FROM chat_messages
        WHERE thread_id = ? AND sender_id != ? AND is_read = 0
    """, (row["id"], current_user_id)).fetchone()[0]

    return {
        "id":              row["id"],
        "partner_name":    partner["anonymous_name"] if partner else "Unknown",
        "last_message":    row["last_message"],
        "last_message_at": row["last_message_at"],
        "unread_count":    unread,
    }


@router.get("/", response_model=List[ChatThreadOut])
def list_my_threads(
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(get_current_user),
):
    uid = current_user["id"]
    rows = conn.execute("""
        SELECT * FROM chat_threads
        WHERE user_a_id = ? OR user_b_id = ?
        ORDER BY last_message_at DESC
    """, (uid, uid)).fetchall()
    return [_thread_out(r, uid, conn) for r in rows]


@router.post("/start/{partner_id}", response_model=ChatThreadOut, status_code=201)
def start_thread(
    partner_id: int,
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a chat thread between current user and another user (or return existing)."""
    uid = current_user["id"]
    if uid == partner_id:
        raise HTTPException(400, "Cannot chat with yourself")

    # Normalise ordering so UNIQUE constraint works regardless of who initiates
    a, b = min(uid, partner_id), max(uid, partner_id)
    existing = conn.execute(
        "SELECT * FROM chat_threads WHERE user_a_id = ? AND user_b_id = ?", (a, b)
    ).fetchone()
    if existing:
        return _thread_out(existing, uid, conn)

    cur = conn.cursor()
    cur.execute(
        "INSERT INTO chat_threads (user_a_id, user_b_id) VALUES (?, ?)", (a, b)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM chat_threads WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _thread_out(row, uid, conn)


@router.get("/{thread_id}/messages", response_model=List[MessageOut])
def get_messages(
    thread_id: int,
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(get_current_user),
):
    uid = current_user["id"]
    # Verify membership
    thread = conn.execute(
        "SELECT * FROM chat_threads WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)",
        (thread_id, uid, uid),
    ).fetchone()
    if not thread:
        raise HTTPException(404, "Thread not found or access denied")

    rows = conn.execute("""
        SELECT m.id, m.thread_id, u.anonymous_name AS sender,
               m.content, m.is_read, m.created_at
        FROM chat_messages m JOIN users u ON u.id = m.sender_id
        WHERE m.thread_id = ?
        ORDER BY m.created_at ASC
    """, (thread_id,)).fetchall()

    # Mark messages from others as read
    conn.execute("""
        UPDATE chat_messages SET is_read = 1
        WHERE thread_id = ? AND sender_id != ? AND is_read = 0
    """, (thread_id, uid))
    conn.commit()

    return [dict(r) | {"is_read": bool(r["is_read"])} for r in rows]


@router.post("/{thread_id}/messages", response_model=MessageOut, status_code=201)
def send_message(
    thread_id: int,
    body: MessageCreate,
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(get_current_user),
):
    uid = current_user["id"]
    thread = conn.execute(
        "SELECT * FROM chat_threads WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)",
        (thread_id, uid, uid),
    ).fetchone()
    if not thread:
        raise HTTPException(404, "Thread not found or access denied")

    cur = conn.cursor()
    cur.execute(
        "INSERT INTO chat_messages (thread_id, sender_id, content) VALUES (?, ?, ?)",
        (thread_id, uid, body.content),
    )
    msg_id = cur.lastrowid

    # Update thread summary
    conn.execute("""
        UPDATE chat_threads
        SET last_message = ?, last_message_at = datetime('now')
        WHERE id = ?
    """, (body.content, thread_id))
    conn.commit()

    row = conn.execute("""
        SELECT m.id, m.thread_id, u.anonymous_name AS sender,
               m.content, m.is_read, m.created_at
        FROM chat_messages m JOIN users u ON u.id = m.sender_id
        WHERE m.id = ?
    """, (msg_id,)).fetchone()
    return dict(row) | {"is_read": bool(row["is_read"])}
