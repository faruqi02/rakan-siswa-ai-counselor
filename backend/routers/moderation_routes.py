"""
routers/moderation_routes.py — AI/Admin content moderation endpoints.
"""

import sqlite3
from typing import List
from fastapi import APIRouter, Depends, HTTPException

from schemas import FlaggedPostOut, ModerationAction
from dependencies import get_db, get_current_user, require_role

router = APIRouter(prefix="/moderation", tags=["Moderation"])


@router.get("/flagged", response_model=List[FlaggedPostOut])
def list_flagged_posts(
    conn: sqlite3.Connection = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    rows = conn.execute("""
        SELECT f.id, f.post_id, u.anonymous_name AS author,
               p.category, p.content, f.toxicity_score,
               f.flagged_by, f.action_taken, f.created_at
        FROM flagged_posts f
        JOIN posts p ON p.id = f.post_id
        JOIN users u ON u.id = p.author_id
        WHERE f.action_taken = 'Pending' OR f.action_taken IS NULL
        ORDER BY f.toxicity_score DESC
    """).fetchall()
    return [dict(r) for r in rows]


@router.patch("/flagged/{flag_id}", response_model=FlaggedPostOut)
def moderate_post(
    flag_id: int,
    body: ModerationAction,
    conn: sqlite3.Connection = Depends(get_db),
    admin=Depends(require_role("admin")),
):
    """
    Actions:
      - Approved  → post stays visible, flag resolved
      - Blocked   → post hidden (is_flagged stays 1 in posts), flag resolved
      - Dismissed → flag removed, post stays visible
    """
    flag = conn.execute("SELECT * FROM flagged_posts WHERE id = ?", (flag_id,)).fetchone()
    if not flag:
        raise HTTPException(404, "Flag record not found")

    allowed = {"Approved", "Blocked", "Dismissed"}
    if body.action not in allowed:
        raise HTTPException(400, f"action must be one of {allowed}")

    conn.execute("""
        UPDATE flagged_posts
        SET action_taken = ?, reviewed_by = ?, resolved_at = datetime('now')
        WHERE id = ?
    """, (body.action, admin["id"], flag_id))

    # If blocked, keep post flagged so it won't show in feed.
    # If approved/dismissed, un-flag the post so it shows again.
    if body.action in ("Approved", "Dismissed"):
        conn.execute("UPDATE posts SET is_flagged = 0 WHERE id = ?", (flag["post_id"],))
    conn.commit()

    # Log the action
    conn.execute("""
        INSERT INTO system_logs (event_type, description, actor_id)
        VALUES ('MOD', ?, ?)
    """, (f"Post #{flag['post_id']} moderation: {body.action}", admin["id"]))
    conn.commit()

    row = conn.execute("""
        SELECT f.id, f.post_id, u.anonymous_name AS author,
               p.category, p.content, f.toxicity_score,
               f.flagged_by, f.action_taken, f.created_at
        FROM flagged_posts f
        JOIN posts p ON p.id = f.post_id
        JOIN users u ON u.id = p.author_id
        WHERE f.id = ?
    """, (flag_id,)).fetchone()
    return dict(row)


@router.post("/flag/{post_id}", status_code=204)
def flag_post_manually(
    post_id: int,
    toxicity_score: float = 0.5,
    conn: sqlite3.Connection = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    """Admin manually flags a post."""
    post = conn.execute("SELECT id FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not post:
        raise HTTPException(404, "Post not found")
    conn.execute(
        "UPDATE posts SET is_flagged = 1, toxicity_score = ? WHERE id = ?",
        (toxicity_score, post_id),
    )
    conn.execute("""
        INSERT INTO flagged_posts (post_id, flagged_by, toxicity_score, action_taken)
        VALUES (?, 'Admin', ?, 'Pending')
    """, (post_id, toxicity_score))
    conn.commit()
