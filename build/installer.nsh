; ============================================================
; ProQuote — NSIS custom installer (multi-language, UTF-8 BOM)
; ============================================================

!macro customHeader
  BrandingText "ProQuote"
!macroend

!macro customInstallMode
  SetShellVarContext current
!macroend

!macro customInstall
  FileOpen $R0 "$INSTDIR\lang.txt" w
  FileWrite $R0 "$LANGUAGE"
  FileClose $R0
  CreateDirectory "$SMPROGRAMS\ProQuote"
  CreateShortcut "$SMPROGRAMS\ProQuote\Uninstall ProQuote.lnk" "$INSTDIR\Uninstall ProQuote.exe"
!macroend

!macro customUnInstall
; الحفاظ على بيانات المستخدم (%APPDATA%\ProQuote) بعد إلغاء التثبيت
!macroend
