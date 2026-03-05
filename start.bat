@echo off
echo Starting WaterfallCalc...

:: Start backend
cd /d "%~dp0backend"
start "WaterfallCalc Backend" cmd /c "venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8002 --reload"

:: Start frontend
cd /d "%~dp0frontend"
start "WaterfallCalc Frontend" cmd /c "npx vite --host --port 5174"

:: Wait for frontend to be ready then open browser
timeout /t 4 /nobreak >nul
start http://localhost:5174

echo Backend running on http://localhost:8002
echo Frontend running on http://localhost:5174
