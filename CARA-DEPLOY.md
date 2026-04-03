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

## Cara 3: GitHub Pages (Percuma, Kekal)

1. Daftar di **https://github.com** (jika belum ada akaun)
2. Klik **"New Repository"**
3. Namakan repo: `kehadiran-pelajar`
4. Upload **semua** fail dalam folder projek ini (termasuk `firebase-config.js`, `.nojekyll`, `404.html`) — repo **ini sahaja** untuk kehadiran, jangan campur folder projek lain.
5. Pergi ke **Settings > Pages**
6. Pilih Source: **Deploy from a branch**
7. Pilih Branch: **main**, folder: **/ (root)**
8. Klik Save
9. URL anda: `https://username.github.io/kehadiran-pelajar`

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

1. Guna URL **kehadiran sahaja** (contoh GitHub Pages repo kehadiran anda), bukan domain/projek lain.
2. Jangan letak fail kehadiran dalam **folder yang sama** dengan aplikasi lain di server yang sama — deploy dalam repo atau subdomain berasingan.
3. Chrome/Edge: `F12` → **Application** → **Service workers** → **Unregister** untuk URL kehadiran; kemudian **Clear site data**.
4. Cuba **Ctrl+Shift+R** atau buka dalam **mod penyamaran**.
5. Di telefon: padam shortcut **Tambah ke Skrin Utama** lama, tambah semula selepas buka URL yang betul.
