import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "rakan_siswa.db"

def main():
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("ALTER TABLE users ADD COLUMN last_active TEXT DEFAULT '2020-01-01 00:00:00'")
        conn.execute("UPDATE users SET last_active = datetime('now')")
        conn.commit()
        print("Column added successfully.")
    except Exception as e:
        print("Error:", e)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
