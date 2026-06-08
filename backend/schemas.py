"""
schemas.py — Pydantic models (request bodies & response shapes) for the API.
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ─────────────────────────── AUTH ───────────────────────────

class RegisterRequest(BaseModel):
    real_name:      str = Field(..., min_length=2, max_length=100)
    email:          str
    phone:          Optional[str] = None
    gender:         Optional[str] = None   # 'Male' | 'Female' | 'Other'
    anonymous_name: str = Field(..., min_length=2, max_length=50)
    password:       str = Field(..., min_length=6)

class LoginRequest(BaseModel):
    email:    str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    role:         str
    anonymous_name: str
    user_id:      int


# ─────────────────────────── USERS ───────────────────────────

class UserPublic(BaseModel):
    id:             int
    anonymous_name: str
    role:           str
    status:         str
    flag_count:     int
    created_at:     str

class UserPrivate(UserPublic):
    real_name:  str
    email:      str
    phone:      Optional[str]
    gender:     Optional[str]

class UserStatusUpdate(BaseModel):
    status: str   # 'Active' | 'Suspended' | 'Deactivated'


# ─────────────────────────── TRAINEE PROFILE ───────────────────────────

class TraineeProfileUpdate(BaseModel):
    specialty:    Optional[str]  = None
    languages:    Optional[str]  = None
    is_available: Optional[bool] = None
    next_slot:    Optional[str]  = None

class TraineeProfileOut(BaseModel):
    user_id:       int
    anonymous_name: str
    specialty:     Optional[str]
    languages:     Optional[str]
    rating:        float
    sessions_done: int
    is_available:  bool
    next_slot:     Optional[str]
    gender:        Optional[str]


# ─────────────────────────── POSTS ───────────────────────────

class PostCreate(BaseModel):
    category: str
    content:  str = Field(..., min_length=10, max_length=2000)

class PostOut(BaseModel):
    id:             int
    author:         str   # anonymous_name
    category:       str
    content:        str
    likes:          int
    comments_count: int
    ai_verified:    bool
    is_flagged:     bool
    toxicity_score: Optional[float]
    created_at:     str

class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)

class CommentOut(BaseModel):
    id:         int
    post_id:    int
    author:     str
    content:    str
    created_at: str


# ─────────────────────────── MOOD ───────────────────────────

class MoodLogCreate(BaseModel):
    mood:        str  # 'Happy' | 'Calm' | 'Stressed' | 'Anxious' | 'Sad' | 'Angry' | 'Overwhelmed'
    emoji:       Optional[str] = None
    note:        Optional[str] = None
    logged_date: Optional[str] = None  # ISO date string, defaults to today

class MoodLogOut(BaseModel):
    id:          int
    user_id:     int
    mood:        str
    emoji:       Optional[str]
    note:        Optional[str]
    logged_date: str
    created_at:  str


# ─────────────────────────── CHAT ───────────────────────────

class ChatThreadOut(BaseModel):
    id:              int
    partner_name:    str   # anonymous_name of the other user
    last_message:    Optional[str]
    last_message_at: Optional[str]
    unread_count:    int

class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

class MessageOut(BaseModel):
    id:         int
    thread_id:  int
    sender:     str   # anonymous_name
    content:    str
    is_read:    bool
    created_at: str


# ─────────────────────────── APPOINTMENTS ───────────────────────────

class AppointmentCreate(BaseModel):
    trainee_id:   int
    topic:        str = Field(..., min_length=3, max_length=200)
    scheduled_at: str   # ISO datetime string e.g. "2026-05-01T15:00:00"
    duration_min: Optional[int] = 45

class AppointmentStatusUpdate(BaseModel):
    status:         str
    student_rating: Optional[int] = None
    notes:          Optional[str] = None

class AppointmentOut(BaseModel):
    id:             int
    student_name:   str
    trainee_name:   str
    topic:          str
    scheduled_at:   str
    duration_min:   int
    status:         str
    student_rating: Optional[int]
    notes:          Optional[str]
    created_at:     str


# ─────────────────────────── FLAGS / MODERATION ───────────────────────────

class FlaggedPostOut(BaseModel):
    id:             int
    post_id:        int
    author:         str
    category:       str
    content:        str
    toxicity_score: float
    flagged_by:     str
    action_taken:   Optional[str]
    created_at:     str

class ModerationAction(BaseModel):
    action:  str   # 'Approved' | 'Blocked' | 'Dismissed'
    reason:  Optional[str] = None


# ─────────────────────────── NOTIFICATIONS ───────────────────────────

class NotificationOut(BaseModel):
    id:         int
    icon:       str
    message:    str
    is_read:    bool
    link_type:  Optional[str]
    link_id:    Optional[int]
    created_at: str


# ─────────────────────────── SYSTEM LOGS ───────────────────────────

class SystemLogOut(BaseModel):
    id:          int
    event_type:  str
    description: str
    actor_name:  Optional[str]
    created_at:  str


# ─────────────────────────── ANALYTICS ───────────────────────────

class AnalyticsSummary(BaseModel):
    total_users:          int
    active_students:      int
    active_trainees:      int
    total_posts:          int
    flagged_posts_count:  int
    sessions_this_week:   int
    mood_logs_today:      int
    pending_appointments: int
