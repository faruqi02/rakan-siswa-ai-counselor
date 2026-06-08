"""
routers/post_routes.py — Social feed CRUD + like/comment endpoints.
"""

import sqlite3
from typing import List
from fastapi import APIRouter, Depends, HTTPException

from schemas import PostCreate, PostOut, CommentCreate, CommentOut
from dependencies import get_db, get_current_user

router = APIRouter(prefix="/posts", tags=["Posts"])


def _row_to_post(row) -> dict:
    return {
        **dict(row),
        "ai_verified": bool(row["ai_verified"]),
        "is_flagged":  bool(row["is_flagged"]),
    }


@router.get("/", response_model=List[PostOut])
def list_posts(
    category: str = None,
    limit: int = 50,
    conn: sqlite3.Connection = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get all (non-blocked) feed posts, newest first. Optionally filter by category."""
    query = """
        SELECT p.id, u.anonymous_name AS author, p.category, p.content,
               p.likes, p.comments_count, p.ai_verified, p.is_flagged,
               p.toxicity_score, p.created_at
        FROM posts p
        JOIN users u ON u.id = p.author_id
        WHERE p.is_flagged = 0
    """
    params: list = []
    if category:
        query += " AND p.category = ?"
        params.append(category)
    query += " ORDER BY p.created_at DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    return [_row_to_post(r) for r in rows]


@router.post("/", response_model=PostOut, status_code=201)
def create_post(
    body: PostCreate,
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO posts (author_id, category, content, ai_verified)
        VALUES (?, ?, ?, 1)
    """, (current_user["id"], body.category, body.content))
    post_id = cur.lastrowid
    conn.commit()

    row = conn.execute("""
        SELECT p.id, u.anonymous_name AS author, p.category, p.content,
               p.likes, p.comments_count, p.ai_verified, p.is_flagged,
               p.toxicity_score, p.created_at
        FROM posts p JOIN users u ON u.id = p.author_id
        WHERE p.id = ?
    """, (post_id,)).fetchone()
    return _row_to_post(row)


@router.post("/{post_id}/like", status_code=204)
def toggle_like(
    post_id: int,
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(get_current_user),
):
    existing = conn.execute(
        "SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?",
        (post_id, current_user["id"]),
    ).fetchone()

    if existing:
        conn.execute("DELETE FROM post_likes WHERE id = ?", (existing["id"],))
        conn.execute("UPDATE posts SET likes = MAX(likes - 1, 0) WHERE id = ?", (post_id,))
    else:
        conn.execute(
            "INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)",
            (post_id, current_user["id"]),
        )
        conn.execute("UPDATE posts SET likes = likes + 1 WHERE id = ?", (post_id,))
    conn.commit()


@router.get("/{post_id}/comments", response_model=List[CommentOut])
def get_comments(
    post_id: int,
    conn: sqlite3.Connection = Depends(get_db),
    _user=Depends(get_current_user),
):
    rows = conn.execute("""
        SELECT c.id, c.post_id, u.anonymous_name AS author, c.content, c.created_at
        FROM post_comments c JOIN users u ON u.id = c.author_id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
    """, (post_id,)).fetchall()
    return [dict(r) for r in rows]


@router.post("/{post_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(
    post_id: int,
    body: CommentCreate,
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO post_comments (post_id, author_id, content) VALUES (?, ?, ?)",
        (post_id, current_user["id"], body.content),
    )
    conn.execute("UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?", (post_id,))
    comment_id = cur.lastrowid
    conn.commit()

    row = conn.execute("""
        SELECT c.id, c.post_id, u.anonymous_name AS author, c.content, c.created_at
        FROM post_comments c JOIN users u ON u.id = c.author_id
        WHERE c.id = ?
    """, (comment_id,)).fetchone()
    return dict(row)
