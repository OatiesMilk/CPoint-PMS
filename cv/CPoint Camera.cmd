@echo off
rem CPoint Camera: opens the camera station window without a terminal (D-063).
rem Double-click it, or run "python -m cpoint_cv shortcut" once to put it on the desktop.
setlocal
pushd "%~dp0"
if not exist ".venv\Scripts\pythonw.exe" (
  set "CPOINT_MSG=The camera station is not set up on this PC: cv\.venv was not found. In cv\README.md, follow Set up the station: py -3.13 -m venv .venv, then install the requirements."
  goto fail
)
".venv\Scripts\python.exe" -c "import cpoint_cv.window.app, cv2, PIL, tkinter" >nul 2>&1
if errorlevel 1 (
  set "CPOINT_MSG=The camera station packages are missing or broken in cv\.venv. In cv\README.md, follow Set up the station: install the CUDA build of torch, then pip install -r requirements.txt. Then run: python -m cpoint_cv doctor"
  goto fail
)
start "" ".venv\Scripts\pythonw.exe" -m cpoint_cv window
popd
exit /b 0

:fail
echo %CPOINT_MSG%
powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [void][System.Windows.MessageBox]::Show($env:CPOINT_MSG, 'CPoint Camera', 'OK', 'Warning')"
popd
exit /b 1
