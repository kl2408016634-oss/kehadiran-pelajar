/* ======================================
   Sistem Kehadiran Pelajar v2.0
   Firebase + localStorage | Mobile-First
   ====================================== */

// ====== DATA STORE ======
let studentsCache = [];
let recordsCache = {};
let metaCache = {};
let dataReady = false;

function getStudents() { return studentsCache; }
function getAttendanceRecords() { return recordsCache; }
function getAttendanceMeta() { return metaCache; }

function saveStudents(students) {
    studentsCache = students;
    if (useFirebase && db) { db.ref('students').set(students); }
    else { localStorage.setItem('students', JSON.stringify(students)); }
}

function saveAttendanceRecords(records) {
    recordsCache = records;
    if (useFirebase && db) { db.ref('attendanceRecords').set(records); }
    else { localStorage.setItem('attendanceRecords', JSON.stringify(records)); }
}

function saveAttendanceMeta(meta) {
    metaCache = meta;
    if (useFirebase && db) { db.ref('attendanceMeta').set(meta); }
    else { localStorage.setItem('attendanceMeta', JSON.stringify(meta)); }
}

function loadData() {
    return new Promise((resolve) => {
        if (useFirebase && db) {
            let loaded = 0;
            const checkDone = () => { if (++loaded >= 3) resolve(); };

            db.ref('students').on('value', (snap) => {
                studentsCache = snap.val() || [];
                if (!Array.isArray(studentsCache)) studentsCache = Object.values(studentsCache);
                if (dataReady) refreshAllViews();
                checkDone();
            });
            db.ref('attendanceRecords').on('value', (snap) => {
                recordsCache = snap.val() || {};
                if (dataReady) refreshAllViews();
                checkDone();
            });
            db.ref('attendanceMeta').on('value', (snap) => {
                metaCache = snap.val() || {};
                if (dataReady) refreshAllViews();
                checkDone();
            });
        } else {
            studentsCache = JSON.parse(localStorage.getItem('students') || '[]');
            recordsCache = JSON.parse(localStorage.getItem('attendanceRecords') || '{}');
            metaCache = JSON.parse(localStorage.getItem('attendanceMeta') || '{}');
            resolve();
        }
    });
}

function refreshAllViews() {
    updateClassFilters();
    updateDashboard();
    renderStudentList();
    renderAttendanceForm();
    populateExportStudentSelect();
}

// ====== SERVICE WORKER ======
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}

// ====== INIT ======
document.addEventListener('DOMContentLoaded', async () => {
    setCurrentDate();
    setDefaultDates();
    showLoadingState(true);
    await loadData();
    dataReady = true;
    refreshAllViews();
    showLoadingState(false);
    setupMobileOverlay();
    showConnectionStatus();
});

function showLoadingState(loading) {
    const el = document.getElementById('loading-indicator');
    if (loading && !el) {
        const d = document.createElement('div');
        d.id = 'loading-indicator';
        d.innerHTML = '<p style="text-align:center;padding:2rem;color:#64748b;">Memuatkan data...</p>';
        document.getElementById('tab-dashboard').prepend(d);
    } else if (!loading && el) el.remove();
}

function showConnectionStatus() {
    if (useFirebase) showToast('Firebase disambungkan! Data dikongsi.', 'success');
    else showToast('Mod offline — data dalam browser ini sahaja.', 'info');
}

function setCurrentDate() {
    const today = new Date();
    document.getElementById('current-date').textContent =
        today.toLocaleDateString('ms-MY', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().slice(0, 5);
    document.getElementById('attendance-date').value = today;
    document.getElementById('attendance-time-start').value = now;
    document.getElementById('attendance-time-end').value = now;
    document.getElementById('record-date').value = today;
    document.getElementById('export-daily-date').value = today;
    document.getElementById('export-date-from').value = today;
    document.getElementById('export-date-to').value = today;
}

// ====== NAVIGATION ======
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).classList.add('active');

    const sideBtn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
    const botBtn = document.querySelector(`.bottom-nav-btn[data-tab="${tabName}"]`);
    if (sideBtn) sideBtn.classList.add('active');
    if (botBtn) botBtn.classList.add('active');

    const titles = { dashboard:'Dashboard', students:'Senarai Pelajar', attendance:'Ambil Kehadiran', records:'Rekod', export:'Export PDF' };
    document.getElementById('page-title').textContent = titles[tabName] || tabName;

    if (tabName === 'dashboard') updateDashboard();
    if (tabName === 'students') renderStudentList();
    if (tabName === 'attendance') renderAttendanceForm();
    if (tabName === 'records') loadRecords();
    if (tabName === 'export') populateExportStudentSelect();

    document.getElementById('sidebar').classList.remove('open');
    window.scrollTo(0, 0);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ====== STUDENTS ======
function addStudent(event) {
    event.preventDefault();
    const name = document.getElementById('student-name').value.trim();
    const cls = document.getElementById('student-class').value.trim();

    if (!name || !cls) { showToast('Sila isi semua maklumat.', 'error'); return; }

    const students = getStudents();

    // Check duplicate name in same class
    if (students.some(s => s.name.toLowerCase() === name.toLowerCase() && s.class === cls)) {
        showToast('Pelajar dengan nama & kelas yang sama sudah wujud!', 'error'); return;
    }

    // Auto-generate unique ID
    const id = 'S' + Date.now();
    students.push({ id, name, class: cls });
    students.sort((a, b) => a.name.localeCompare(b.name));
    saveStudents(students);

    document.getElementById('add-student-form').reset();
    showToast(`"${name}" berjaya ditambah!`, 'success');
    updateClassFilters(); renderStudentList(); renderAttendanceForm();
}

function renderStudentList() {
    const students = getStudents();
    const search = document.getElementById('search-student').value.toLowerCase();
    const cf = document.getElementById('filter-class').value;

    const filtered = students.filter(s => {
        const ms = s.name.toLowerCase().includes(search);
        return ms && (!cf || s.class === cf);
    });

    const tbody = document.getElementById('student-table-body');
    const cards = document.getElementById('student-card-list');
    const noMsg = document.getElementById('no-students-msg');

    if (filtered.length === 0) {
        tbody.innerHTML = ''; cards.innerHTML = '';
        noMsg.style.display = 'block'; return;
    }

    noMsg.style.display = 'none';

    // Desktop table
    tbody.innerHTML = filtered.map((s, i) => `
        <tr>
            <td>${i+1}</td>
            <td>${esc(s.name)}</td>
            <td>${esc(s.class)}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteStudent('${esc(s.id)}')">🗑 Padam</button></td>
        </tr>`).join('');

    // Mobile cards
    cards.innerHTML = filtered.map((s, i) => `
        <div class="mobile-card-item">
            <div class="mobile-card-info">
                <span class="mc-name">${i+1}. ${esc(s.name)}</span>
                <span class="mc-sub">${esc(s.class)}</span>
            </div>
            <button class="btn btn-danger btn-sm" onclick="deleteStudent('${esc(s.id)}')">🗑</button>
        </div>`).join('');
}

let deleteTargetId = null;
function deleteStudent(id) {
    deleteTargetId = id;
    const s = getStudents().find(x => x.id === id);
    document.getElementById('modal-message').textContent = `Padam "${s ? s.name : id}"?`;
    document.getElementById('modal-overlay').style.display = 'flex';
}
function confirmDelete() {
    if (!deleteTargetId) return;
    const students = getStudents().filter(s => s.id !== deleteTargetId);
    saveStudents(students);
    showToast('Pelajar dipadam.', 'info');
    closeModal(); updateClassFilters(); renderStudentList(); renderAttendanceForm();
    deleteTargetId = null;
}
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }

// ====== CLASS FILTERS ======
function updateClassFilters() {
    const classes = [...new Set(getStudents().map(s => s.class))].sort();
    ['filter-class','attendance-class-filter','record-class-filter','export-class-filter'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const v = sel.value;
        sel.innerHTML = '<option value="">Semua Kelas</option>' +
            classes.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
        sel.value = v;
    });
}

// ====== ATTENDANCE ======
function renderAttendanceForm() {
    const students = getStudents();
    const cf = document.getElementById('attendance-class-filter').value;
    const filtered = cf ? students.filter(s => s.class === cf) : students;

    const tbody = document.getElementById('attendance-table-body');
    const cards = document.getElementById('attendance-card-list');
    const noMsg = document.getElementById('no-attendance-msg');
    const saveSection = document.getElementById('save-attendance-section');

    if (filtered.length === 0) {
        tbody.innerHTML = ''; cards.innerHTML = '';
        noMsg.style.display = 'block'; saveSection.style.display = 'none'; return;
    }

    noMsg.style.display = 'none';
    saveSection.style.display = 'flex';

    const date = document.getElementById('attendance-date').value;
    const dr = (getAttendanceRecords()[date]) || {};

    // Desktop table
    tbody.innerHTML = filtered.map((s, i) => {
        const st = dr[s.id] || tempAttendance[s.id] || '';
        return `<tr>
            <td>${i+1}</td>
            <td>${esc(s.name)}</td>
            <td>${esc(s.class)}</td>
            <td><div class="attendance-toggle">
                <button class="toggle-btn ${st==='hadir'?'active-present':''}" onclick="setAttendance('${esc(s.id)}','hadir',this)">✅ Hadir</button>
                <button class="toggle-btn ${st==='tidak hadir'?'active-absent':''}" onclick="setAttendance('${esc(s.id)}','tidak hadir',this)">❌ Tidak Hadir</button>
            </div></td></tr>`;
    }).join('');

    // Mobile cards
    cards.innerHTML = filtered.map((s, i) => {
        const st = dr[s.id] || tempAttendance[s.id] || '';
        return `<div class="mobile-card-item" style="flex-direction:column;align-items:stretch;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem;">
                <div class="mobile-card-info">
                    <span class="mc-name">${i+1}. ${esc(s.name)}</span>
                    <span class="mc-sub">${esc(s.class)}</span>
                </div>
            </div>
            <div class="attendance-card-toggle">
                <button class="toggle-btn ${st==='hadir'?'active-present':''}" onclick="setAttendance('${esc(s.id)}','hadir',this)" style="flex:1;">✅ Hadir</button>
                <button class="toggle-btn ${st==='tidak hadir'?'active-absent':''}" onclick="setAttendance('${esc(s.id)}','tidak hadir',this)" style="flex:1;">❌ Tidak Hadir</button>
            </div>
        </div>`;
    }).join('');
}

let tempAttendance = {};

function setAttendance(id, status, btn) {
    tempAttendance[id] = status;
    const parent = btn.closest('.attendance-toggle, .attendance-card-toggle');
    parent.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active-present','active-absent'));
    btn.classList.add(status === 'hadir' ? 'active-present' : 'active-absent');
}

function markAll(status) {
    const cf = document.getElementById('attendance-class-filter').value;
    const filtered = cf ? getStudents().filter(s => s.class === cf) : getStudents();
    filtered.forEach(s => { tempAttendance[s.id] = status; });

    document.querySelectorAll('#attendance-table-body .attendance-toggle, #attendance-card-list .attendance-card-toggle').forEach(row => {
        row.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active-present','active-absent'));
        if (status === 'hadir') row.querySelector('.toggle-btn:first-child').classList.add('active-present');
        else row.querySelector('.toggle-btn:last-child').classList.add('active-absent');
    });
    showToast(`Semua ditandakan "${status}".`, 'info');
}

function saveAttendance() {
    const date = document.getElementById('attendance-date').value;
    const timeStart = document.getElementById('attendance-time-start').value;
    const timeEnd = document.getElementById('attendance-time-end').value;
    const instructor = document.getElementById('attendance-instructor').value.trim();

    if (!date) { showToast('Sila pilih tarikh.', 'error'); return; }
    if (!instructor) { showToast('Sila masukkan nama pengajar.', 'error'); return; }
    if (!timeStart || !timeEnd) { showToast('Sila masukkan masa mula dan tamat.', 'error'); return; }

    const cf = document.getElementById('attendance-class-filter').value;
    const filtered = cf ? getStudents().filter(s => s.class === cf) : getStudents();
    const unmarked = filtered.filter(s => !tempAttendance[s.id]);
    if (unmarked.length > 0) {
        showToast(`${unmarked.length} pelajar belum ditandakan.`, 'error'); return;
    }

    const records = getAttendanceRecords();
    if (!records[date]) records[date] = {};
    filtered.forEach(s => { records[date][s.id] = tempAttendance[s.id]; });
    saveAttendanceRecords(records);

    // Save meta (instructor, time range)
    const meta = getAttendanceMeta();
    meta[date] = { instructor, timeStart, timeEnd, savedAt: new Date().toISOString() };
    saveAttendanceMeta(meta);

    tempAttendance = {};
    showToast(`Kehadiran ${date} disimpan!`, 'success');
    updateDashboard();
}

// ====== RECORDS ======
function loadRecords() {
    const date = document.getElementById('record-date').value;
    const cf = document.getElementById('record-class-filter').value;
    const records = getAttendanceRecords();
    const meta = getAttendanceMeta();
    const students = getStudents();

    const tbody = document.getElementById('records-table-body');
    const cards = document.getElementById('records-card-list');
    const noMsg = document.getElementById('no-records-msg');
    const summary = document.getElementById('record-summary');
    const instrInfo = document.getElementById('record-instructor-info');

    if (!date || !records[date]) {
        tbody.innerHTML = ''; cards.innerHTML = '';
        noMsg.style.display = 'block';
        noMsg.textContent = date ? 'Tiada rekod untuk tarikh ini.' : 'Pilih tarikh.';
        summary.style.display = 'none'; instrInfo.style.display = 'none'; return;
    }

    // Show instructor info
    const dm = meta[date];
    if (dm) {
        instrInfo.style.display = 'flex';
        instrInfo.innerHTML = `<span>👨‍🏫 <strong>${esc(dm.instructor)}</strong></span><span>🕐 ${esc(dm.timeStart || dm.time || '')} - ${esc(dm.timeEnd || '')}</span>`;
    } else { instrInfo.style.display = 'none'; }

    const dr = records[date];
    let fs = students.filter(s => dr[s.id]);
    if (cf) fs = fs.filter(s => s.class === cf);

    if (fs.length === 0) {
        tbody.innerHTML = ''; cards.innerHTML = '';
        noMsg.style.display = 'block'; noMsg.textContent = 'Tiada rekod.';
        summary.style.display = 'none'; return;
    }

    noMsg.style.display = 'none'; summary.style.display = 'flex';
    const pc = fs.filter(s => dr[s.id]==='hadir').length;
    const ac = fs.filter(s => dr[s.id]==='tidak hadir').length;
    document.getElementById('record-present-count').textContent = pc;
    document.getElementById('record-absent-count').textContent = ac;
    document.getElementById('record-total-count').textContent = fs.length;

    // Desktop
    tbody.innerHTML = fs.map((s,i) => {
        const st = dr[s.id];
        const bc = st==='hadir'?'badge-present':'badge-absent';
        const bt = st==='hadir'?'✅ Hadir':'❌ Tidak Hadir';
        return `<tr><td>${i+1}</td><td>${esc(s.name)}</td><td>${esc(s.class)}</td><td><span class="badge ${bc}">${bt}</span></td></tr>`;
    }).join('');

    // Mobile
    cards.innerHTML = fs.map((s,i) => {
        const st = dr[s.id];
        const bc = st==='hadir'?'badge-present':'badge-absent';
        const bt = st==='hadir'?'✅ Hadir':'❌ Tidak Hadir';
        return `<div class="mobile-card-item">
            <div class="mobile-card-info"><span class="mc-name">${i+1}. ${esc(s.name)}</span><span class="mc-sub">${esc(s.class)}</span></div>
            <span class="badge ${bc}">${bt}</span></div>`;
    }).join('');
}

// ====== DASHBOARD ======
function updateDashboard() {
    const students = getStudents();
    const records = getAttendanceRecords();
    const meta = getAttendanceMeta();
    const today = new Date().toISOString().split('T')[0];
    const tr = records[today] || {};
    const dm = meta[today];

    const total = students.length;
    const present = students.filter(s => tr[s.id]==='hadir').length;
    const absent = students.filter(s => tr[s.id]==='tidak hadir').length;
    const recorded = present + absent;
    const pct = recorded > 0 ? Math.round((present/recorded)*100) : 0;

    document.getElementById('stat-total-students').textContent = total;
    document.getElementById('stat-present-today').textContent = present;
    document.getElementById('stat-absent-today').textContent = absent;
    document.getElementById('stat-percent-today').textContent = pct + '%';

    // Instructor info
    const instrDiv = document.getElementById('dashboard-instructor-info');
    if (dm) {
        instrDiv.style.display = 'flex';
        instrDiv.innerHTML = `<span>👨‍🏫 <strong>${esc(dm.instructor)}</strong></span><span>🕐 ${esc(dm.timeStart || dm.time || '')} - ${esc(dm.timeEnd || '')}</span>`;
    } else { instrDiv.style.display = 'none'; }

    const todayList = document.getElementById('today-attendance-list');
    const absentList = document.getElementById('today-absent-list');

    const ps = students.filter(s => tr[s.id]==='hadir');
    const as = students.filter(s => tr[s.id]==='tidak hadir');

    todayList.innerHTML = ps.length > 0 ? ps.map(s => `
        <div class="today-list-item">
            <div class="student-info-mini"><span class="name">${esc(s.name)}</span><span class="class-name">${esc(s.class)}</span></div>
            <span class="badge badge-present">✅</span></div>`).join('') :
        '<p class="empty-message">Tiada rekod kehadiran hari ini.</p>';

    absentList.innerHTML = as.length > 0 ? as.map(s => `
        <div class="today-list-item">
            <div class="student-info-mini"><span class="name">${esc(s.name)}</span><span class="class-name">${esc(s.class)}</span></div>
            <span class="badge badge-absent">❌</span></div>`).join('') :
        '<p class="empty-message">Tiada pelajar tidak hadir.</p>';
}

// ====== EXPORT PDF ======
function toggleExportOptions() {
    const t = document.getElementById('export-type').value;
    document.getElementById('export-daily-options').style.display = t==='daily'?'block':'none';
    document.getElementById('export-range-options').style.display = t==='range'?'block':'none';
    document.getElementById('export-student-options').style.display = t==='student'?'block':'none';
}

function populateExportStudentSelect() {
    const sel = document.getElementById('export-student-select');
    sel.innerHTML = getStudents().map(s => `<option value="${esc(s.id)}">${esc(s.name)} — ${esc(s.class)}</option>`).join('');
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const type = document.getElementById('export-type').value;
    const school = document.getElementById('export-school-name').value || 'Institusi Pendidikan';
    const cf = document.getElementById('export-class-filter').value;
    const doc = new jsPDF();
    const students = getStudents();
    const records = getAttendanceRecords();
    const meta = getAttendanceMeta();

    // Header
    doc.setFontSize(18); doc.setFont(undefined,'bold');
    doc.text(school, 105, 20, {align:'center'});
    doc.setFontSize(14);
    doc.text('LAPORAN KEHADIRAN PELAJAR', 105, 30, {align:'center'});
    doc.setLineWidth(0.5); doc.line(20, 34, 190, 34);

    if (type==='daily') exportDailyPDF(doc, students, records, meta, cf);
    else if (type==='range') exportRangePDF(doc, students, records, meta, cf);
    else exportStudentPDF(doc, students, records, meta);

    // Footer
    const pages = doc.internal.getNumberOfPages();
    for (let i=1; i<=pages; i++) {
        doc.setPage(i); doc.setFontSize(8); doc.setFont(undefined,'normal');
        doc.text(`Dijana: ${new Date().toLocaleString('ms-MY')} | Halaman ${i}/${pages}`, 105, 290, {align:'center'});
    }

    doc.save(`Kehadiran_${type}_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('PDF dimuat turun!', 'success');
    updateExportPreview(type, students, records, cf);
}

function exportDailyPDF(doc, students, records, meta, cf) {
    const date = document.getElementById('export-daily-date').value;
    const dr = records[date] || {};
    const dm = meta[date];
    let filtered = students.filter(s => dr[s.id]);
    if (cf) filtered = filtered.filter(s => s.class === cf);

    let y = 42;
    doc.setFontSize(11); doc.setFont(undefined,'normal');
    doc.text(`Tarikh: ${fmtDate(date)}`, 20, y); y += 6;
    if (dm) {
        doc.text(`Pengajar: ${dm.instructor}`, 20, y); y += 6;
        doc.text(`Masa: ${dm.timeStart || dm.time || ''} - ${dm.timeEnd || ''}`, 20, y); y += 6;
    }
    if (cf) { doc.text(`Kelas: ${cf}`, 20, y); y += 6; }

    const pc = filtered.filter(s => dr[s.id]==='hadir').length;
    const ac = filtered.filter(s => dr[s.id]==='tidak hadir').length;
    doc.text(`Hadir: ${pc} | Tidak Hadir: ${ac} | Jumlah: ${filtered.length}`, 20, y); y += 4;

    if (filtered.length === 0) { doc.text('Tiada rekod.', 20, y+8); return; }

    doc.autoTable({
        startY: y + 4,
        head: [['No.','Nama Pelajar','Kelas','Status']],
        body: filtered.map((s,i) => [i+1, s.name, s.class, dr[s.id]==='hadir'?'HADIR':'TIDAK HADIR']),
        theme:'grid',
        headStyles:{fillColor:[79,70,229],textColor:255,fontStyle:'bold',halign:'center'},
        styles:{fontSize:9,cellPadding:3},
        columnStyles:{0:{halign:'center',cellWidth:12},3:{halign:'center',cellWidth:30}},
        alternateRowStyles:{fillColor:[245,247,250]},
        didParseCell(d){if(d.column.index===3&&d.section==='body'){d.cell.styles.fontStyle='bold';d.cell.styles.textColor=d.cell.raw==='HADIR'?[5,150,105]:[220,38,38];}}
    });
}

function exportRangePDF(doc, students, records, meta, cf) {
    const from = document.getElementById('export-date-from').value;
    const to = document.getElementById('export-date-to').value;
    if (!from||!to) { showToast('Pilih tarikh.','error'); return; }

    let y = 42;
    doc.setFontSize(11); doc.setFont(undefined,'normal');
    doc.text(`Tempoh: ${fmtDate(from)} - ${fmtDate(to)}`, 20, y); y += 6;
    if (cf) { doc.text(`Kelas: ${cf}`, 20, y); y += 6; }

    let filtered = cf ? students.filter(s => s.class===cf) : [...students];
    const dates = []; let cur = new Date(from); const end = new Date(to);
    while (cur<=end) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate()+1); }

    doc.autoTable({
        startY: y + 2,
        head:[['No.','Nama','Kelas','Hadir','Tidak Hadir','Jumlah','%']],
        body: filtered.map((s,i) => {
            let p=0,a=0;
            dates.forEach(d=>{if(records[d]&&records[d][s.id]){records[d][s.id]==='hadir'?p++:a++;}});
            const t=p+a; return [i+1,s.name,s.class,p,a,t,t>0?Math.round(p/t*100)+'%':'0%'];
        }),
        theme:'grid',
        headStyles:{fillColor:[79,70,229],textColor:255,fontStyle:'bold',halign:'center',fontSize:8},
        styles:{fontSize:8,cellPadding:2.5},
        columnStyles:{0:{halign:'center',cellWidth:10},3:{halign:'center',cellWidth:15},4:{halign:'center',cellWidth:18},5:{halign:'center',cellWidth:15},6:{halign:'center',cellWidth:15}},
        alternateRowStyles:{fillColor:[245,247,250]},
        didParseCell(d){if(d.column.index===6&&d.section==='body'){const v=parseInt(d.cell.raw);d.cell.styles.fontStyle='bold';d.cell.styles.textColor=v>=80?[5,150,105]:v>=50?[245,158,11]:[220,38,38];}}
    });
}

function exportStudentPDF(doc, students, records, meta) {
    const sid = document.getElementById('export-student-select').value;
    const student = students.find(s=>s.id===sid);
    if (!student) { showToast('Pilih pelajar.','error'); return; }

    let y = 42;
    doc.setFontSize(11); doc.setFont(undefined,'normal');
    doc.text(`Nama: ${student.name}`, 20, y); y+=6;
    doc.text(`Kelas: ${student.class}`, 20, y); y+=8;

    const rows = []; let tp=0,ta=0;
    Object.keys(records).sort().forEach(date => {
        if (records[date][sid]) {
            const st = records[date][sid];
            st==='hadir'?tp++:ta++;
            const dm = meta[date];
            const timeStr = dm ? `${dm.timeStart||dm.time||'-'} - ${dm.timeEnd||''}` : '-';
            rows.push([rows.length+1, fmtDate(date), timeStr, dm?dm.instructor:'-', st==='hadir'?'HADIR':'TIDAK HADIR']);
        }
    });

    const total=tp+ta; const pct=total>0?Math.round(tp/total*100):0;
    doc.text(`Hadir: ${tp} | Tidak Hadir: ${ta} | Jumlah: ${total} hari | ${pct}%`, 20, y); y+=4;

    if (rows.length===0) { doc.text('Tiada rekod.', 20, y+8); return; }

    doc.autoTable({
        startY: y+4,
        head:[['No.','Tarikh','Masa','Pengajar','Status']],
        body: rows, theme:'grid',
        headStyles:{fillColor:[79,70,229],textColor:255,fontStyle:'bold',halign:'center'},
        styles:{fontSize:9,cellPadding:3},
        columnStyles:{0:{halign:'center',cellWidth:10},2:{cellWidth:18},3:{cellWidth:35},4:{halign:'center',cellWidth:28}},
        alternateRowStyles:{fillColor:[245,247,250]},
        didParseCell(d){if(d.column.index===4&&d.section==='body'){d.cell.styles.fontStyle='bold';d.cell.styles.textColor=d.cell.raw==='HADIR'?[5,150,105]:[220,38,38];}}
    });
}

function updateExportPreview(type, students, records, cf) {
    const p = document.getElementById('export-preview');
    if (type==='daily') {
        const date = document.getElementById('export-daily-date').value;
        const dr = records[date]||{};
        let f = students.filter(s=>dr[s.id]);
        if (cf) f=f.filter(s=>s.class===cf);
        p.innerHTML = `<h4>${fmtDate(date)}</h4><p>Hadir: <strong style="color:var(--success)">${f.filter(s=>dr[s.id]==='hadir').length}</strong> | Tidak Hadir: <strong style="color:var(--danger)">${f.filter(s=>dr[s.id]==='tidak hadir').length}</strong></p><p>PDF dimuat turun.</p>`;
    } else if (type==='range') { p.innerHTML='<p>PDF dimuat turun.</p>'; }
    else { const s=students.find(x=>x.id===document.getElementById('export-student-select').value); p.innerHTML=`<h4>${s?s.name:''}</h4><p>PDF dimuat turun.</p>`; }
}

// ====== UTILITY ======
function esc(t) { const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
function fmtDate(s) { if(!s) return ''; return new Date(s+'T00:00:00').toLocaleDateString('ms-MY',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); }

function showToast(msg, type='info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`; t.textContent = msg;
    c.appendChild(t);
    setTimeout(()=>t.remove(), 3000);
}

// ====== MOBILE OVERLAY ======
function setupMobileOverlay() {
    const o = document.createElement('div');
    o.className='sidebar-overlay'; o.id='sidebar-overlay';
    o.addEventListener('click',()=>{document.getElementById('sidebar').classList.remove('open');o.classList.remove('visible');});
    document.body.appendChild(o);

    window.toggleSidebar = function(){
        const s=document.getElementById('sidebar');
        s.classList.toggle('open');
        o.classList.toggle('visible',s.classList.contains('open'));
    };

    document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>o.classList.remove('visible')));

    let sx=0;
    document.addEventListener('touchstart',e=>{sx=e.changedTouches[0].screenX;},{passive:true});
    document.addEventListener('touchend',e=>{
        const d=e.changedTouches[0].screenX-sx;
        if(sx<30&&d>80){document.getElementById('sidebar').classList.add('open');o.classList.add('visible');}
        if(d<-80&&document.getElementById('sidebar').classList.contains('open')){document.getElementById('sidebar').classList.remove('open');o.classList.remove('visible');}
    },{passive:true});
}

// ====== PWA INSTALL ======
let deferredPrompt;
window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault(); deferredPrompt=e;
    const b=document.createElement('button');
    b.className='btn btn-primary install-btn'; b.innerHTML='📲 Pasang App';
    b.addEventListener('click',()=>{deferredPrompt.prompt();deferredPrompt.userChoice.then(c=>{if(c.outcome==='accepted')showToast('App dipasang!','success');deferredPrompt=null;b.remove();});});
    const f=document.querySelector('.sidebar-footer'); if(f) f.prepend(b);
});
