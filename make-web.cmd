@echo off
chcp 65001 >nul
echo ============================================================
echo  ProQuote — بناء نسخة الويب (جاهزة للرفع على Vercel)
echo ============================================================
setlocal
set SRC=src\renderer
set OUT=web-dist

if exist %OUT% rmdir /s /q %OUT%
mkdir %OUT%

xcopy /e /i /y "%SRC%\assets" "%OUT%\assets" >nul
xcopy /e /i /y "%SRC%\i18n" "%OUT%\i18n" >nul
copy /y "%SRC%\index.html" "%OUT%\index.html" >nul
copy /y "vercel.json" "%OUT%\vercel.json" >nul

echo.
echo تم بنجاح ✓ — المجلد: %OUT%
echo ارفعه إلى Vercel:  npx vercel --prod  (من داخل المجلد)
echo أو اسحبه وأفلته في https://vercel.com/new
echo.
endlocal
pause
