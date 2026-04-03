# Cara Deploy Online - Sistem Kehadiran Pelajar

## Cara 1: Netlify Drop (PALING MUDAH - Percuma!)

1. Buka browser dan pergi ke: **https://app.netlify.com/drop**
2. **Drag & drop** folder `attendance sk` ke kawasan upload
3. Tunggu beberapa saat - anda akan dapat link URL (contoh: `https://random-name-123.netlify.app`)
4. Share link tersebut - sesiapa pun boleh buka di phone!

### Untuk URL kekal (optional):
- Klik "Claim this site" dan daftar akaun Netlify (percuma)
- Tukar nama URL di Settings > Site details > Change site name

---

## Cara 2: Tiiny.host (Sangat Mudah)

1. Pergi ke **https://tiiny.host**
2. Zip seluruh folder kehadiran (semua fail `.html`, `.css`, `.js`, `.json`, `.nojekyll`)
3. Upload fail zip tersebut
4. Anda akan dapat URL yang boleh dikongsi

---

## Cara 3: Domain / hosting sendiri (cPanel, VPS, dll.)

1. Zip semua fail projek kehadiran.
2. Muat naik ke folder `public_html` (atau subfolder) melalui **File Manager** / FTP.
3. Pastikan `index.html` di root folder yang URL tunjuk ke situ.
4. URL jadi ikut domain anda sendiri (contoh `https://sekolah.edu.my/kehadiran/`).

*(GitHub Pages ialah pilihan lain jika anda sudah biasa — kod aplikasi ini **tidak** bergantung pada mana-mana domain tertentu.)*

---

## Buka di Phone

Selepas deploy, buka URL di phone browser. Kemudian:

### Android:
- Buka menu browser (3 titik) > "Add to Home screen"
- Aplikasi akan nampak macam app biasa di phone!

### iPhone:
- Buka di Safari > Tap ikon Share > "Add to Home Screen"
- Aplikasi akan nampak macam app biasa di phone!

---

## Masalah: Buka tapak tapi paparan salah / “sistem lain”

Ini biasanya **bukan** kod yang dicampur, tetapi **URL salah**, **cache**, atau **folder lain di server**.

1. Guna URL **folder kehadiran** yang betul, bukan domain/projek lain.
2. Jangan letak fail kehadiran dalam **folder yang sama** dengan aplikasi lain — guna folder atau subdomain berasingan.
3. Chrome/Edge: `F12` → **Application** → **Service workers** → **Unregister** untuk URL kehadiran; kemudian **Clear site data**.
4. Cuba **Ctrl+Shift+R** atau buka dalam **mod penyamaran**.
5. Di telefon: padam shortcut **Tambah ke Skrin Utama** lama, tambah semula selepas buka URL yang betul.
