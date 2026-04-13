@echo off
SET PATH=C:\Users\vlaiosa\.nodejs-portable\node-v20.19.2-win-x64;%PATH%
cd /d "%~dp0"
npm.cmd run web -- --clear
