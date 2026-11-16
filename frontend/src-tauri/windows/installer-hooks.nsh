; خطافات مُثبّت NSIS (tauri.conf.json > bundle.windows.nsis.installerHooks).
; الـ backend (sidecar بايثون) عملية منفصلة: لو بقيت شغالة (crash قديم مثلاً) يفضل
; dealzora-backend.exe مقفولاً ويفشل استبداله. نقفله قبل النسخ وقبل الحذف.
; taskkill بلا أثر لو العملية مش موجودة.

!macro NSIS_HOOK_PREINSTALL
  nsExec::Exec 'taskkill /F /T /IM dealzora-backend.exe'
  Pop $0
  Sleep 500
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::Exec 'taskkill /F /T /IM dealzora-backend.exe'
  Pop $0
  Sleep 500
!macroend
