@where pythonw >nul 2>nul && (start "" /D "%~dp0" pythonw "%~dp0firefly.py" %*) || (start "" /D "%~dp0" pyw "%~dp0firefly.py" %*)
