"""
database.py — SQLite database setup and connection for Rakan Siswa backend.
Creates all tables if they don't exist, and provides a get_db() dependency.
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "rakan_siswa.db"


def get_connection() -> sqlite3.Connection:
    """Return a new SQLite connection with Row factory enabled."""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db() -> None:
    """Create all schema tables and seed demo data on first run."""
    conn = get_connection()
    cur = conn.cursor()

    # ──────────────────────────────────────────────
    # TABLE: users
    # Core identity table.  Real PII is stored here;
    # only anonymous_name is ever exposed publicly.
    # ──────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            real_name       TEXT    NOT NULL,
            email           TEXT    NOT NULL UNIQUE,
            phone           TEXT,
            gender          TEXT    CHECK(gender IN ('Male','Female','Other')),
            anonymous_name  TEXT    NOT NULL UNIQUE,
            password_hash   TEXT    NOT NULL,
            role            TEXT    NOT NULL DEFAULT 'student'
                                CHECK(role IN ('student','trainee','admin')),
            status          TEXT    NOT NULL DEFAULT 'Active'
                                CHECK(status IN ('Active','Suspended','Deactivated')),
            flag_count      INTEGER NOT NULL DEFAULT 0,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    """)

    # ──────────────────────────────────────────────
    # TABLE: trainee_profiles
    # Extended info for users with role='trainee'.
    # ──────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS trainee_profiles (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            specialty       TEXT,
            languages       TEXT    DEFAULT 'EN',
            rating          REAL    DEFAULT 0.0,
            sessions_done   INTEGER DEFAULT 0,
            is_available    INTEGER NOT NULL DEFAULT 1,   -- 0/1 boolean
            next_slot       TEXT,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    """)

    # ──────────────────────────────────────────────
    # TABLE: posts  (Social Feed)
    # Anonymous social posts written by students.
    # ──────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            author_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            category        TEXT    NOT NULL,
            content         TEXT    NOT NULL,
            likes           INTEGER NOT NULL DEFAULT 0,
            comments_count  INTEGER NOT NULL DEFAULT 0,
            ai_verified     INTEGER NOT NULL DEFAULT 0,   -- 0/1 boolean
            is_flagged      INTEGER NOT NULL DEFAULT 0,   -- 0/1 boolean
            toxicity_score  REAL    DEFAULT NULL,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    """)

    # ──────────────────────────────────────────────
    # TABLE: post_comments
    # ──────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS post_comments (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id         INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            author_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content         TEXT    NOT NULL,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    """)

    # ──────────────────────────────────────────────
    # TABLE: post_likes
    # Prevents a user liking the same post twice.
    # ──────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS post_likes (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id         INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            UNIQUE(post_id, user_id)
        );
    """)

    # ──────────────────────────────────────────────
    # TABLE: mood_logs
    # Daily mood entries per student.
    # ──────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS mood_logs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            mood            TEXT    NOT NULL
                                CHECK(mood IN ('Happy','Calm','Stressed','Anxious','Sad','Angry','Overwhelmed')),
            emoji           TEXT,
            note            TEXT,
            logged_date     TEXT    NOT NULL DEFAULT (date('now')),
            created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    """)

    # ──────────────────────────────────────────────
    # TABLE: chat_threads
    # A thread between exactly two users (peer chat).
    # ──────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_threads (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_a_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            user_b_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            last_message    TEXT,
            last_message_at TEXT    DEFAULT (datetime('now')),
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            UNIQUE(user_a_id, user_b_id)
        );
    """)

    # ──────────────────────────────────────────────
    # TABLE: chat_messages
    # Individual messages within a thread.
    # ──────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_id       INTEGER NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
            sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content         TEXT    NOT NULL,
            is_read         INTEGER NOT NULL DEFAULT 0,  -- 0=unread, 1=read
            created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    """)

    # ──────────────────────────────────────────────
    # TABLE: appointments / counselling sessions
    # A booking request from a student to a trainee.
    # ──────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS appointments (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            trainee_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            topic           TEXT    NOT NULL,
            scheduled_at    TEXT    NOT NULL,
            duration_min    INTEGER DEFAULT 45,
            status          TEXT    NOT NULL DEFAULT 'Pending'
                                CHECK(status IN ('Pending','Confirmed','In Progress','Resolved','Improved','Ongoing','Cancelled')),
            student_rating  INTEGER CHECK(student_rating BETWEEN 1 AND 5),
            notes           TEXT,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    """)

    # ──────────────────────────────────────────────
    # TABLE: flagged_posts
    # AI or manual flags on posts that need review.
    # ──────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS flagged_posts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id         INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            flagged_by      TEXT    NOT NULL DEFAULT 'AI'
                                CHECK(flagged_by IN ('AI','Admin','User')),
            toxicity_score  REAL    NOT NULL,
            reason          TEXT,
            action_taken    TEXT    CHECK(action_taken IN ('Pending','Approved','Blocked','Dismissed')),
            reviewed_by     INTEGER REFERENCES users(id),
            created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
            resolved_at     TEXT
        );
    """)

    # ──────────────────────────────────────────────
    # TABLE: notifications
    # In-app notifications for any user.
    # ──────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            icon            TEXT    DEFAULT 'Bell',
            message         TEXT    NOT NULL,
            is_read         INTEGER NOT NULL DEFAULT 0,
            link_type       TEXT,   -- e.g. 'chat', 'appointment', 'post'
            link_id         INTEGER,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    """)

    # ──────────────────────────────────────────────
    # TABLE: system_logs
    # Platform-level audit/event log (Admin view).
    # ──────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS system_logs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type      TEXT    NOT NULL,
            description     TEXT    NOT NULL,
            actor_id        INTEGER REFERENCES users(id),
            created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    """)

    conn.commit()
    _seed_demo_data(cur, conn)
    conn.close()


def _seed_demo_data(cur: sqlite3.Cursor, conn: sqlite3.Connection) -> None:
    """Insert demo users + sample data only if the DB is empty."""
    existing = cur.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if existing > 0:
        return  # already seeded

    import bcrypt as _bcrypt

    def _hash(pw: str) -> str:
        return _bcrypt.hashpw(pw.encode(), _bcrypt.gensalt()).decode()

    # ── Demo Users ──
    demo_users = [
        # (real_name, email, phone, gender, anonymous_name, password, role)
        ("Ahmad Fikri",   "student@siswa.ums.edu.my", "+60123000001", "Male",   "User#A93K",   "student123", "student"),
        ("Lim Hui Ying",  "trainee@ums.edu.my",       "+60123000002", "Female", "Helper#H42P", "trainee123", "trainee"),
        ("Raj Kumar",     "admin@ums.edu.my",          "+60123000003", "Male",   "Admin#R001",  "admin123",   "admin"),
        ("Nurul Ain",     "nurul@siswa.ums.edu.my",    "+60123000004", "Female", "User#B27Q",   "pass1234",   "student"),
        ("Tan Mei Ling",  "mei@ums.edu.my",            "+60123000005", "Female", "Helper#L17S", "pass1234",   "trainee"),
        ("Zaid Hamdan",   "zaid@siswa.ums.edu.my",     "+60123000006", "Male",   "User#Z11A",   "pass1234",   "student"),
    ]

    user_ids = {}
    for real_name, email, phone, gender, anon_name, password, role in demo_users:
        cur.execute("""
            INSERT INTO users (real_name, email, phone, gender, anonymous_name, password_hash, role)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (real_name, email, phone, gender, anon_name, _hash(password), role))
        user_ids[anon_name] = cur.lastrowid

    # ── Trainee Profiles ──
    trainee_data = [
        (user_ids["Helper#H42P"], "Anxiety & Stress",   "EN/BM",       4.8, 47, 1, "Today 3:00 PM"),
        (user_ids["Helper#L17S"], "Academic Burnout",   "EN/BM/中文",  4.9, 38, 1, "Tomorrow 10:00 AM"),
    ]
    for row in trainee_data:
        cur.execute("""
            INSERT INTO trainee_profiles (user_id, specialty, languages, rating, sessions_done, is_available, next_slot)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, row)

    # ── Sample Posts ──
    posts_data = [
        (user_ids["User#A93K"], "Academic Stress",
         "Final exams are next week and I haven't slept properly in days. Anyone else feel like they're drowning in lecture notes? 😔",
         24, 8, 1, 0, None),
        (user_ids["User#B27Q"], "Mental Health",
         "Started journaling every morning and it's helped me a lot with anxiety. Small wins matter. 💜",
         56, 12, 1, 0, None),
        (user_ids["User#Z11A"], "Mental Health",
         "I feel like giving up entirely. There is no point anymore.",
         0, 0, 0, 1, 0.92),
    ]
    for row in posts_data:
        cur.execute("""
            INSERT INTO posts (author_id, category, content, likes, comments_count, ai_verified, is_flagged, toxicity_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, row)
        post_id = cur.lastrowid
        if row[7]:  # if flagged, insert into flagged_posts
            cur.execute("""
                INSERT INTO flagged_posts (post_id, flagged_by, toxicity_score, reason, action_taken)
                VALUES (?, 'AI', ?, 'Potential self-harm language', 'Pending')
            """, (post_id, row[7]))

    # ── Sample Mood Logs ──
    moods = [
        (user_ids["User#A93K"], "Happy", "😊"),
        (user_ids["User#A93K"], "Stressed", "😣"),
        (user_ids["User#A93K"], "Calm", "😌"),
    ]
    for uid, mood, emoji in moods:
        cur.execute("INSERT INTO mood_logs (user_id, mood, emoji) VALUES (?, ?, ?)", (uid, mood, emoji))

    # ── Sample Chat Thread ──
    cur.execute("""
        INSERT INTO chat_threads (user_a_id, user_b_id, last_message, last_message_at)
        VALUES (?, ?, 'I hear you. Want to talk through it?', datetime('now'))
    """, (user_ids["User#A93K"], user_ids["Helper#H42P"]))
    thread_id = cur.lastrowid

    sample_messages = [
        (user_ids["Helper#H42P"], "Hi, I'm here to listen. How are you feeling today?"),
        (user_ids["User#A93K"],   "Honestly, overwhelmed. I have 3 deadlines this week."),
        (user_ids["Helper#H42P"], "That sounds heavy. Let's break it down — which feels biggest?"),
        (user_ids["User#A93K"],   "The stats assignment. I don't even know where to start."),
        (user_ids["Helper#H42P"], "I hear you. Want to talk through it?"),
    ]
    for sender_id, content in sample_messages:
        cur.execute("""
            INSERT INTO chat_messages (thread_id, sender_id, content)
            VALUES (?, ?, ?)
        """, (thread_id, sender_id, content))

    # ── Sample Appointments ──
    cur.execute("""
        INSERT INTO appointments (student_id, trainee_id, topic, scheduled_at, duration_min, status, student_rating)
        VALUES (?, ?, 'Exam anxiety', '2026-04-22 15:00', 45, 'Improved', 5)
    """, (user_ids["User#A93K"], user_ids["Helper#H42P"]))

    # ── Sample Notifications ──
    notifs = [
        (user_ids["User#A93K"], "MessageSquare", "New message from Helper#H42P", "chat"),
        (user_ids["User#A93K"], "Calendar",       "Your booking with Helper#L17S is confirmed", "appointment"),
        (user_ids["User#A93K"], "Bell",            "Reminder: log your mood today 🌸", None),
    ]
    for uid, icon, msg, link_type in notifs:
        cur.execute("""
            INSERT INTO notifications (user_id, icon, message, link_type)
            VALUES (?, ?, ?, ?)
        """, (uid, icon, msg, link_type))

    # ── Sample System Logs ──
    logs = [
        ("FLAG", "New flagged post by User#Z11A (toxicity 0.92)", user_ids.get("Admin#R001")),
        ("STAT", "Stress posts increased 47% this week", None),
        ("REG",  "New trainee Helper#L17S registered", user_ids["Helper#L17S"]),
    ]
    for etype, desc, actor in logs:
        cur.execute("""
            INSERT INTO system_logs (event_type, description, actor_id)
            VALUES (?, ?, ?)
        """, (etype, desc, actor))

    conn.commit()
