=== BODHI WEBSITE TEST AREA ===
File asli index.html (sebelum update) disimpan di sini.
Setelah user uji coba di URL utama, file asli bisa di-restore dari sini.

Public URL: https://instructors-radios-shelter-heart.trycloudflare.com
Local:      http://127.0.0.1:5002

File backup: index_original.html (868 KB)
File aktif : templates/index.html (baru)

Restore command:
  cp index_original.html ../templates/index.html
  pkill -f "python3 app.py"  # restart Flask
