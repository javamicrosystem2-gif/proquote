@echo off
chcp 65001 >nul
REM ============================================================
REM ProQuote — رفع نسخة الويب إلى سيرفر aaPanel
REM الاستخدام: حرر المتغيرين أدناه ثم شغّل الملف
REM ============================================================

REM عنوان السيرفر (مثال: root@123.45.67.89 أو ubuntu@...)
set SERVER=root@123.45.67.89

REM مسار مجلد الموقع على السيرفر (الافتراضي في aaPanel — غيّر اسم الموقع)
set SITE_DIR=/www/wwwroot/proquote.duckdns.org

REM ------------------------------------------------------------
echo [1/3] رفع ملفات نسخة الويب إلى %SITE_DIR% ...
scp -r "%~dp0web-dist\*" %SERVER%:%SITE_DIR%/
if errorlevel 1 (echo فشل الرفع - تأكد من SERVER ومن وصول SSH & pause & exit /b 1)

echo [2/3] ضبط الصلاحيات ...
ssh %SERVER% "chown -R www:www %SITE_DIR% && chmod -R 755 %SITE_DIR%"
if errorlevel 1 (echo تحذير: تعذر ضبط الصلاحيات تلقائياً - نفذها يدوياً من اللوحة)

echo [3/3] تم ✓ - افتح موقعك في المتصفح للتأكد
pause
