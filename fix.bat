@echo off
echo 🧹 Cleaning up...

:: Stop any running Metro
taskkill /F /IM node.exe 2>nul

:: Clear npm cache
call npm cache clean --force

:: Remove node_modules and lock files
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
if exist .expo rmdir /s /q .expo

echo 📦 Installing dependencies...
call npm install

echo 🔧 Applying patches...
call npx patch-package

echo 🚀 Starting app...
call npx expo start --clear

pause