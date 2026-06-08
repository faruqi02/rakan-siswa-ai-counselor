"""
routers/analytics_routes.py — Admin analytics & system log endpoints.
"""

import sqlite3
from typing import List
from fastapi import APIRouter, Depends

from schemas import AnalyticsSummary, SystemLogOut
from dependencies import get_db, require_role

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
def get_summary(
    conn: sqlite3.Connection = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    def scalar(q, *args):
        return conn.execute(q, args).fetchone()[0]

    return AnalyticsSummary(
        total_users=          scalar("SELECT COUNT(*) FROM users"),
        active_students=      scalar("SELECT COUNT(*) FROM users WHERE role='student' AND status='Active'"),
        active_trainees=      scalar("SELECT COUNT(*) FROM users WHERE role='trainee' AND status='Active'"),
        total_posts=          scalar("SELECT COUNT(*) FROM posts"),
        flagged_posts_count=  scalar("SELECT COUNT(*) FROM flagged_posts WHERE action_taken='Pending' OR action_taken IS NULL"),
        sessions_this_week=   scalar("""
            SELECT COUNT(*) FROM appointments
            WHERE scheduled_at >= date('now', '-7 days')
              AND status NOT IN ('Cancelled','Pending')
        """),
        mood_logs_today=      scalar("SELECT COUNT(*) FROM mood_logs WHERE logged_date = date('now')"),
        pending_appointments= scalar("SELECT COUNT(*) FROM appointments WHERE status='Pending'"),
    )


@router.get("/logs", response_model=List[SystemLogOut])
def get_system_logs(
    limit: int = 50,
    conn: sqlite3.Connection = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    rows = conn.execute("""
        SELECT sl.id, sl.event_type, sl.description,
               u.anonymous_name AS actor_name, sl.created_at
        FROM system_logs sl
        LEFT JOIN users u ON u.id = sl.actor_id
        ORDER BY sl.created_at DESC
        LIMIT ?
    """, (limit,)).fetchall()
    return [dict(r) for r in rows]
