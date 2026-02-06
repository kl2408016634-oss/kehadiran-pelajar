/* ======================================
   Firebase Configuration
   ======================================
   
   ARAHAN SETUP:
   1. Pergi ke https://console.firebase.google.com
   2. Klik "Create a project" / "Add project"
   3. Namakan project: "kehadiran-pelajar"
   4. Klik Continue (boleh disable Google Analytics)
   5. Klik "Create project", tunggu siap
   6. Klik ikon Web </> untuk tambah web app
   7. Namakan app: "kehadiran"
   8. JANGAN tick "Firebase Hosting"
   9. Klik "Register app"
   10. Copy nilai-nilai dari firebaseConfig dan paste di bawah
   11. Di menu kiri, klik "Build" > "Realtime Database"
   12. Klik "Create Database"
   13. Pilih location (pilih mana-mana)
   14. Pilih "Start in TEST MODE" > Klik "Enable"
   15. Siap! Upload semula semua fail ke GitHub

   ====================================== */

const firebaseConfig = {
    apiKey: "AIzaSyD4J8KmZu3T7DcIbCFfIBs6wfRIg1CNczY",
    authDomain: "kehadiran-pelajar-e3dbe.firebaseapp.com",
    databaseURL: "https://kehadiran-pelajar-e3dbe-default-rtdb.firebaseio.com",
    projectId: "kehadiran-pelajar-e3dbe",
    storageBucket: "kehadiran-pelajar-e3dbe.firebasestorage.app",
    messagingSenderId: "201029436278",
    appId: "1:201029436278:web:3db7e13b17e399ed54f057"
};

// ====== JANGAN UBAH BAWAH INI ======

let db = null;
let useFirebase = false;

try {
    // Check if config has been filled in
    if (firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('PASTE_')) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        useFirebase = true;
        console.log('Firebase connected!');
    } else {
        console.log('Firebase not configured. Using localStorage (data hanya di browser ini).');
    }
} catch (err) {
    console.log('Firebase error, fallback to localStorage:', err);
    useFirebase = false;
}
