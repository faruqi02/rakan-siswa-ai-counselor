"""
routers/appointment_routes.py — Counselling appointment booking and management.
"""

import sqlite3
from typing import List
from fastapi import APIRouter, Depends, HTTPException

from schemas import AppointmentCreate, AppointmentStatusUpdate, AppointmentOut
from dependencies import get_db, get_current_user, require_role

router = APIRouter(prefix="/appointments", tags=["Appointments"])


def _apt_row(row) -> dict:
    return dict(row)


@router.get("/", response_model=List[AppointmentOut])
def list_appointments(
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Students see their own bookings; trainees see bookings assigned to them."""
    uid  = current_user["id"]
    role = current_user["role"]

    if role == "student":
        filter_col = "a.student_id"
    elif role == "trainee":
        filter_col = "a.trainee_id"
    else:  # admin sees all
        rows = conn.execute("""
            SELECT a.id,
                   us.anonymous_name AS student_name,
                   ut.anonymous_name AS trainee_name,
                   a.topic, a.scheduled_at, a.duration_min,
                   a.status, a.student_rating, a.notes, a.created_at
            FROM appointments a
            JOIN users us ON us.id = a.student_id
            JOIN users ut ON ut.id = a.trainee_id
            ORDER BY a.scheduled_at DESC
        """).fetchall()
        return [_apt_row(r) for r in rows]

    rows = conn.execute(f"""
        SELECT a.id,
               us.anonymous_name AS student_name,
               ut.anonymous_name AS trainee_name,
               a.topic, a.scheduled_at, a.duration_min,
               a.status, a.student_rating, a.notes, a.created_at
        FROM appointments a
        JOIN users us ON us.id = a.student_id
        JOIN users ut ON ut.id = a.trainee_id
        WHERE {filter_col} = ?
        ORDER BY a.scheduled_at DESC
    """, (uid,)).fetchall()
    return [_apt_row(r) for r in rows]


@router.post("/", response_model=AppointmentOut, status_code=201)
def book_appointment(
    body: AppointmentCreate,
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    # Ensure trainee exists and is available
    trainee = conn.execute("""
        SELECT tp.is_available, u.anonymous_name
        FROM trainee_profiles tp JOIN users u ON u.id = tp.user_id
        WHERE tp.user_id = ?
    """, (body.trainee_id,)).fetchone()
    if not trainee:
        raise HTTPException(404, "Trainee not found")
    if not trainee["is_available"]:
        raise HTTPException(409, "This trainee is currently unavailable")

    cur = conn.cursor()
    cur.execute("""
        INSERT INTO appointments (student_id, trainee_id, topic, scheduled_at, duration_min, status)
        VALUES (?, ?, ?, ?, ?, 'Pending')
    """, (current_user["id"], body.trainee_id, body.topic, body.scheduled_at, body.duration_min))
    apt_id = cur.lastrowid
    conn.commit()

    row = conn.execute("""
        SELECT a.id,
               us.anonymous_name AS student_name,
               ut.anonymous_name AS trainee_name,
               a.topic, a.scheduled_at, a.duration_min,
               a.status, a.student_rating, a.notes, a.created_at
        FROM appointments a
        JOIN users us ON us.id = a.student_id
        JOIN users ut ON ut.id = a.trainee_id
        WHERE a.id = ?
    """, (apt_id,)).fetchone()
    return _apt_row(row)


@router.patch("/{apt_id}", response_model=AppointmentOut)
def update_appointment(
    apt_id: int,
    body: AppointmentStatusUpdate,
    conn: sqlite3.Connection = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Trainees confirm/resolve; students can add a rating."""
    apt = conn.execute("SELECT * FROM appointments WHERE id = ?", (apt_id,)).fetchone()
    if not apt:
        raise HTTPException(404, "Appointment not found")

    uid  = current_user["id"]
    role = current_user["role"]

    # Only involved users or admin can update
    if role == "student" and apt["student_id"] != uid:
        raise HTTPException(403, "Not your appointment")
    if role == "trainee" and apt["trainee_id"] != uid:
        raise HTTPException(403, "Not your appointment")

    updates: dict = {"status": body.status, "updated_at": "datetime('now')"}
    params = [body.status]

    if body.student_rating is not None:
        updates["student_rating"] = body.student_rating
        params.append(body.student_rating)
    if body.notes is not None:
        updates["notes"] = body.notes
        params.append(body.notes)

    set_parts = ["status = ?"]
    if body.student_rating is not None:
        set_parts.append("student_rating = ?")
    if body.notes is not None:
        set_parts.append("notes = ?")
    set_parts.append("updated_at = datetime('now')")

    conn.execute(
        f"UPDATE appointments SET {', '.join(set_parts)} WHERE id = ?",
        (*params, apt_id),
    )
    conn.commit()

    row = conn.execute("""
        SELECT a.id,
               us.anonymous_name AS student_name,
               ut.anonymous_name AS trainee_name,
               a.topic, a.scheduled_at, a.duration_min,
               a.status, a.student_rating, a.notes, a.created_at
        FROM appointments a
        JOIN users us ON us.id = a.student_id
        JOIN users ut ON ut.id = a.trainee_id
        WHERE a.id = ?
    """, (apt_id,)).fetchone()
    return _apt_row(row)
