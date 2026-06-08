@echo off
echo Starting Rakan Siswa Backend...
call venv\Scripts\activate
uvicorn main:app --reload --port 8000
pause
