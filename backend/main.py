"""
main.py — FastAPI application entry point for Rakan Siswa backend.

Run with:
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from database import init_db
from routers import (
    auth_routes,
    user_routes,
    post_routes,
    mood_routes,
    chat_routes,
    appointment_routes,
    moderation_routes,
    notification_routes,
    analytics_routes,
)

# ── Initialise DB on startup ──
init_db()

app = FastAPI(
    title="Rakan Siswa API",
    description="Anonymous peer mental-health support platform — backend REST API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS — allow the Vite dev server ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite default
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register all routers ──
app.include_router(auth_routes.router)
app.include_router(user_routes.router)
app.include_router(post_routes.router)
app.include_router(mood_routes.router)
app.include_router(chat_routes.router)
app.include_router(appointment_routes.router)
app.include_router(moderation_routes.router)
app.include_router(notification_routes.router)
app.include_router(analytics_routes.router)


@app.get("/", tags=["Health"], response_class=HTMLResponse)
def health_check():
    html_content = """
    <html>
        <head>
            <title>Rakan Siswa API</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f0f2f5; margin: 0; }
                .container { background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
                h1 { color: #1e3a8a; margin-top: 0; font-size: 1.8rem; }
                p { color: #4b5563; line-height: 1.5; }
                .btn { display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; transition: background-color 0.2s; }
                .btn:hover { background-color: #1d4ed8; }
                .pulse { display: inline-block; width: 10px; height: 10px; background-color: #10b981; border-radius: 50%; margin-right: 8px; animation: pulse 2s infinite; }
                @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Rakan Siswa API</h1>
                <p><span class="pulse"></span>The backend service is running successfully!</p>
                <a href="/docs" class="btn">View API Docs (Swagger UI)</a>
            </div>
        </body>
    </html>
    """
    return HTMLResponse(content=html_content)
