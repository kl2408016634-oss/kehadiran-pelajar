/* ======================================
   Sistem Kehadiran Pelajar - App Logic
   (Firebase Realtime Database + localStorage fallback)
   ====================================== */

// ====== DATA STORE ======
// In-memory cache
let studentsCache = [];
let recordsCache = {};
let dataReady = false;

function getStudents() {
    return studentsCache;
}

function getAttendanceRecords() {
    return recordsCache;
}

function saveStudents(students) {
    studentsCache = students;
    if (useFirebase && db) {
        db.ref('students').set(students);
    } else {
        localStorage.setItem('students', JSON.stringify(students));
    }
}

function saveAttendanceRecords(records) {
    recordsCache = records;
    if (useFirebase && db) {
        db.ref('attendanceRecords').set(records);
    } else {
        localStorage.setItem('attendanceRecords', JSON.stringify(records));
    }
}

// Load initial data
function loadData() {
    return new Promise((resolve) => {
        if (useFirebase && db) {
            let loaded = 0;
            const checkDone = () => { if (++loaded >= 2) resolve(); };

            db.ref('students').on('value', (snapshot) => {
                studentsCache = snapshot.val() || [];
                // Ensure it's an array
                if (!Array.isArray(studentsCache)) {
                    studentsCache = Object.values(studentsCache);
                }
                if (dataReady) refreshAllViews();
                checkDone();
            });

            db.ref('attendanceRecords').on('value', (snapshot) => {
                recordsCache = snapshot.val() || {};
                if (dataReady) refreshAllViews();
                checkDone();
            });
        } else {
            studentsCache = JSON.parse(localStorage.getItem('students') || '[]');
            recordsCache = JSON.parse(localStorage.getItem('attendanceRecords') || '{}');
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

// ====== SERVICE WORKER REGISTRATION ======
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('SW registration failed:', err));
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
    const dashboard = document.getElementById('tab-dashboard');
    if (loading) {
        const loader = document.createElement('div');
        loader.id = 'loading-indicator';
        loader.innerHTML = '<p style="text-align:center;padding:2rem;color:#64748b;">Memuatkan data...</p>';
        dashboard.prepend(loader);
    } else {
        const loader = document.getElementById('loading-indicator');
        if (loader) loader.remove();
    }
}

function showConnectionStatus() {
    if (useFirebase) {
        showToast('Disambungkan ke Firebase! Data dikongsi untuk semua pengguna.', 'success');
    } else {
        showToast('Mod offline — data hanya di browser ini. Sila setup Firebase untuk berkongsi data.', 'info');
    }
}

function setCurrentDate() {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = today.toLocaleDateString('ms-MY', options);
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('attendance-date').value = today;
    document.getElementById('record-date').value = today;
    document.getElementById('export-daily-date').value = today;
    document.getElementById('export-date-from').value = today;
    document.getElementById('export-date-to').value = today;
}

// ====== NAVIGATION ======
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.querySelector(`.nav-btn[data-tab="${tabName}"]`).classList.add('active');

    const titles = {
        dashboard: 'Dashboard',
        students: 'Senarai Pelajar',
        attendance: 'Ambil Kehadiran',
        records: 'Rekod Kehadiran',
        export: 'Export PDF'
    };
    document.getElementById('page-title').textContent = titles[tabName] || tabName;

    if (tabName === 'dashboard') updateDashboard();
    if (tabName === 'students') renderStudentList();
    if (tabName === 'attendance') renderAttendanceForm();
    if (tabName === 'records') loadRecords();
    if (tabName === 'export') populateExportStudentSelect();

    document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ====== STUDENTS MANAGEMENT ======
function addStudent(event) {
    event.preventDefault();
    const name = document.getElementById('student-name').value.trim();
    const id = document.getElementById('student-id').value.trim();
    const studentClass = document.getElementById('student-class').value.trim();

    if (!name || !id || !studentClass) {
        showToast('Sila isi semua maklumat pelajar.', 'error');
        return;
    }

    const students = getStudents();

    if (students.some(s => s.id === id)) {
        showToast('No. ID sudah wujud! Sila gunakan ID lain.', 'error');
        return;
    }

    students.push({ id, name, class: studentClass });
    students.sort((a, b) => a.name.localeCompare(b.name));
    saveStudents(students);

    document.getElementById('add-student-form').reset();
    showToast(`Pelajar "${name}" berjaya ditambah!`, 'success');

    updateClassFilters();
    renderStudentList();
    renderAttendanceForm();
}

function renderStudentList() {
    const students = getStudents();
    const searchTerm = document.getElementById('search-student').value.toLowerCase();
    const classFilter = document.getElementById('filter-class').value;

    let filtered = students.filter(s => {
        const matchSearch = s.name.toLowerCase().includes(searchTerm) || s.id.toLowerCase().includes(searchTerm);
        const matchClass = !classFilter || s.class === classFilter;
        return matchSearch && matchClass;
    });

    const tbody = document.getElementById('student-table-body');
    const noMsg = document.getElementById('no-students-msg');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        noMsg.style.display = 'block';
        return;
    }

    noMsg.style.display = 'none';
    tbody.innerHTML = filtered.map((s, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(s.id)}</strong></td>
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.class)}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteStudent('${escapeHtml(s.id)}')">🗑 Padam</button>
            </td>
        </tr>
    `).join('');
}

let deleteTargetId = null;

function deleteStudent(studentId) {
    deleteTargetId = studentId;
    const students = getStudents();
    const student = students.find(s => s.id === studentId);
    document.getElementById('modal-message').textContent = `Adakah anda pasti ingin memadam pelajar "${student ? student.name : studentId}"?`;
    document.getElementById('modal-overlay').style.display = 'flex';
}

function confirmDelete() {
    if (!deleteTargetId) return;

    let students = getStudents();
    students = students.filter(s => s.id !== deleteTargetId);
    saveStudents(students);

    showToast('Pelajar berjaya dipadam.', 'info');
    closeModal();

    updateClassFilters();
    renderStudentList();
    renderAttendanceForm();
    deleteTargetId = null;
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

// ====== CLASS FILTER UPDATE ======
function updateClassFilters() {
    const students = getStudents();
    const classes = [...new Set(students.map(s => s.class))].sort();

    const filterIds = ['filter-class', 'attendance-class-filter', 'record-class-filter', 'export-class-filter'];
    filterIds.forEach(filterId => {
        const select = document.getElementById(filterId);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">Semua Kelas</option>' +
            classes.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        select.value = currentVal;
    });
}

// ====== ATTENDANCE ======
function renderAttendanceForm() {
    const students = getStudents();
    const classFilter = document.getElementById('attendance-class-filter').value;

    let filtered = classFilter ? students.filter(s => s.class === classFilter) : students;

    const tbody = document.getElementById('attendance-table-body');
    const noMsg = document.getElementById('no-attendance-msg');
    const saveSection = document.getElementById('save-attendance-section');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        noMsg.style.display = 'block';
        saveSection.style.display = 'none';
        return;
    }

    noMsg.style.display = 'none';
    saveSection.style.display = 'flex';

    const date = document.getElementById('attendance-date').value;
    const records = getAttendanceRecords();
    const dateRecords = records[date] || {};

    tbody.innerHTML = filtered.map((s, i) => {
        const status = dateRecords[s.id] || '';
        return `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(s.id)}</strong></td>
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.class)}</td>
            <td>
                <div class="attendance-toggle">
                    <button class="toggle-btn ${status === 'hadir' ? 'active-present' : ''}" 
                            onclick="setAttendance('${escapeHtml(s.id)}', 'hadir', this)">
                        ✅ Hadir
                    </button>
                    <button class="toggle-btn ${status === 'tidak hadir' ? 'active-absent' : ''}" 
                            onclick="setAttendance('${escapeHtml(s.id)}', 'tidak hadir', this)">
                        ❌ Tidak Hadir
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

let tempAttendance = {};

function setAttendance(studentId, status, btnElement) {
    tempAttendance[studentId] = status;

    const row = btnElement.closest('.attendance-toggle');
    row.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active-present', 'active-absent');
    });

    if (status === 'hadir') {
        btnElement.classList.add('active-present');
    } else {
        btnElement.classList.add('active-absent');
    }
}

function markAll(status) {
    const students = getStudents();
    const classFilter = document.getElementById('attendance-class-filter').value;
    let filtered = classFilter ? students.filter(s => s.class === classFilter) : students;

    filtered.forEach(s => {
        tempAttendance[s.id] = status;
    });

    const rows = document.querySelectorAll('#attendance-table-body .attendance-toggle');
    rows.forEach(row => {
        row.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active-present', 'active-absent');
        });
        if (status === 'hadir') {
            row.querySelector('.toggle-btn:first-child').classList.add('active-present');
        } else {
            row.querySelector('.toggle-btn:last-child').classList.add('active-absent');
        }
    });

    showToast(`Semua pelajar ditandakan sebagai "${status}".`, 'info');
}

function saveAttendance() {
    const date = document.getElementById('attendance-date').value;
    if (!date) {
        showToast('Sila pilih tarikh terlebih dahulu.', 'error');
        return;
    }

    const students = getStudents();
    const classFilter = document.getElementById('attendance-class-filter').value;
    let filtered = classFilter ? students.filter(s => s.class === classFilter) : students;

    const unmarked = filtered.filter(s => !tempAttendance[s.id]);
    if (unmarked.length > 0) {
        showToast(`${unmarked.length} pelajar belum ditandakan. Sila tandakan semua pelajar.`, 'error');
        return;
    }

    const records = getAttendanceRecords();
    if (!records[date]) records[date] = {};

    filtered.forEach(s => {
        records[date][s.id] = tempAttendance[s.id];
    });

    saveAttendanceRecords(records);
    tempAttendance = {};

    showToast(`Kehadiran untuk ${date} berjaya disimpan!`, 'success');
    updateDashboard();
}

// ====== RECORDS ======
function loadRecords() {
    const date = document.getElementById('record-date').value;
    const classFilter = document.getElementById('record-class-filter').value;
    const records = getAttendanceRecords();
    const students = getStudents();

    const tbody = document.getElementById('records-table-body');
    const noMsg = document.getElementById('no-records-msg');
    const summary = document.getElementById('record-summary');

    if (!date || !records[date]) {
        tbody.innerHTML = '';
        noMsg.style.display = 'block';
        noMsg.textContent = date ? 'Tiada rekod kehadiran untuk tarikh ini.' : 'Pilih tarikh untuk melihat rekod kehadiran.';
        summary.style.display = 'none';
        return;
    }

    const dateRecords = records[date];
    let filteredStudents = students.filter(s => dateRecords[s.id]);
    if (classFilter) {
        filteredStudents = filteredStudents.filter(s => s.class === classFilter);
    }

    if (filteredStudents.length === 0) {
        tbody.innerHTML = '';
        noMsg.style.display = 'block';
        noMsg.textContent = 'Tiada rekod kehadiran untuk kelas/tarikh ini.';
        summary.style.display = 'none';
        return;
    }

    noMsg.style.display = 'none';
    summary.style.display = 'flex';

    const presentCount = filteredStudents.filter(s => dateRecords[s.id] === 'hadir').length;
    const absentCount = filteredStudents.filter(s => dateRecords[s.id] === 'tidak hadir').length;

    document.getElementById('record-present-count').textContent = presentCount;
    document.getElementById('record-absent-count').textContent = absentCount;
    document.getElementById('record-total-count').textContent = filteredStudents.length;

    tbody.innerHTML = filteredStudents.map((s, i) => {
        const status = dateRecords[s.id];
        const badgeClass = status === 'hadir' ? 'badge-present' : 'badge-absent';
        const badgeText = status === 'hadir' ? '✅ Hadir' : '❌ Tidak Hadir';
        return `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(s.id)}</strong></td>
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.class)}</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        </tr>`;
    }).join('');
}

// ====== DASHBOARD ======
function updateDashboard() {
    const students = getStudents();
    const records = getAttendanceRecords();
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = records[today] || {};

    const totalStudents = students.length;
    const presentToday = students.filter(s => todayRecords[s.id] === 'hadir').length;
    const absentToday = students.filter(s => todayRecords[s.id] === 'tidak hadir').length;
    const recordedToday = presentToday + absentToday;
    const percent = recordedToday > 0 ? Math.round((presentToday / recordedToday) * 100) : 0;

    document.getElementById('stat-total-students').textContent = totalStudents;
    document.getElementById('stat-present-today').textContent = presentToday;
    document.getElementById('stat-absent-today').textContent = absentToday;
    document.getElementById('stat-percent-today').textContent = percent + '%';

    const todayList = document.getElementById('today-attendance-list');
    const absentList = document.getElementById('today-absent-list');

    const presentStudents = students.filter(s => todayRecords[s.id] === 'hadir');
    const absentStudents = students.filter(s => todayRecords[s.id] === 'tidak hadir');

    if (presentStudents.length > 0) {
        todayList.innerHTML = presentStudents.map(s => `
            <div class="today-list-item">
                <div class="student-info-mini">
                    <span class="name">${escapeHtml(s.name)}</span>
                    <span class="class-name">${escapeHtml(s.class)} • ${escapeHtml(s.id)}</span>
                </div>
                <span class="badge badge-present">✅ Hadir</span>
            </div>
        `).join('');
    } else {
        todayList.innerHTML = '<p class="empty-message">Tiada rekod kehadiran untuk hari ini.</p>';
    }

    if (absentStudents.length > 0) {
        absentList.innerHTML = absentStudents.map(s => `
            <div class="today-list-item">
                <div class="student-info-mini">
                    <span class="name">${escapeHtml(s.name)}</span>
                    <span class="class-name">${escapeHtml(s.class)} • ${escapeHtml(s.id)}</span>
                </div>
                <span class="badge badge-absent">❌ Tidak Hadir</span>
            </div>
        `).join('');
    } else {
        absentList.innerHTML = '<p class="empty-message">Tiada pelajar yang tidak hadir.</p>';
    }
}

// ====== EXPORT PDF ======
function toggleExportOptions() {
    const type = document.getElementById('export-type').value;
    document.getElementById('export-daily-options').style.display = type === 'daily' ? 'flex' : 'none';
    document.getElementById('export-range-options').style.display = type === 'range' ? 'flex' : 'none';
    document.getElementById('export-student-options').style.display = type === 'student' ? 'flex' : 'none';
}

function populateExportStudentSelect() {
    const students = getStudents();
    const select = document.getElementById('export-student-select');
    select.innerHTML = students.map(s =>
        `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (${escapeHtml(s.id)})</option>`
    ).join('');
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const type = document.getElementById('export-type').value;
    const schoolName = document.getElementById('export-school-name').value || 'Institusi Pendidikan';
    const classFilter = document.getElementById('export-class-filter').value;

    const doc = new jsPDF();
    const students = getStudents();
    const records = getAttendanceRecords();

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(schoolName, 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text('LAPORAN KEHADIRAN PELAJAR', 105, 30, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(20, 34, 190, 34);

    if (type === 'daily') {
        exportDailyPDF(doc, students, records, classFilter);
    } else if (type === 'range') {
        exportRangePDF(doc, students, records, classFilter);
    } else if (type === 'student') {
        exportStudentPDF(doc, students, records);
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(
            `Dijana pada: ${new Date().toLocaleString('ms-MY')} | Halaman ${i} / ${pageCount}`,
            105, 290, { align: 'center' }
        );
    }

    const filename = `Kehadiran_${type}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    showToast('PDF berjaya dijana dan dimuat turun!', 'success');
    updateExportPreview(type, students, records, classFilter);
}

function exportDailyPDF(doc, students, records, classFilter) {
    const date = document.getElementById('export-daily-date').value;
    const dateRecords = records[date] || {};

    let filtered = students.filter(s => dateRecords[s.id]);
    if (classFilter) filtered = filtered.filter(s => s.class === classFilter);

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Tarikh: ${formatDate(date)}`, 20, 42);
    if (classFilter) doc.text(`Kelas: ${classFilter}`, 20, 48);

    const presentCount = filtered.filter(s => dateRecords[s.id] === 'hadir').length;
    const absentCount = filtered.filter(s => dateRecords[s.id] === 'tidak hadir').length;
    const startY = classFilter ? 54 : 48;

    doc.text(`Jumlah Hadir: ${presentCount} | Tidak Hadir: ${absentCount} | Jumlah: ${filtered.length}`, 20, startY);

    if (filtered.length === 0) {
        doc.text('Tiada rekod kehadiran untuk tarikh ini.', 20, startY + 10);
        return;
    }

    const tableData = filtered.map((s, i) => [
        i + 1, s.id, s.name, s.class,
        dateRecords[s.id] === 'hadir' ? 'HADIR' : 'TIDAK HADIR'
    ]);

    doc.autoTable({
        startY: startY + 6,
        head: [['No.', 'No. ID', 'Nama Pelajar', 'Kelas', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { halign: 'center', cellWidth: 12 }, 1: { cellWidth: 25 }, 4: { halign: 'center', cellWidth: 30 } },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        didParseCell: function (data) {
            if (data.column.index === 4 && data.section === 'body') {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = data.cell.raw === 'HADIR' ? [5, 150, 105] : [220, 38, 38];
            }
        }
    });
}

function exportRangePDF(doc, students, records, classFilter) {
    const dateFrom = document.getElementById('export-date-from').value;
    const dateTo = document.getElementById('export-date-to').value;

    if (!dateFrom || !dateTo) {
        showToast('Sila pilih tarikh mula dan akhir.', 'error');
        return;
    }

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Tempoh: ${formatDate(dateFrom)} - ${formatDate(dateTo)}`, 20, 42);
    if (classFilter) doc.text(`Kelas: ${classFilter}`, 20, 48);

    let filtered = classFilter ? students.filter(s => s.class === classFilter) : [...students];

    const dates = [];
    let current = new Date(dateFrom);
    const end = new Date(dateTo);
    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }

    const tableData = filtered.map((s, i) => {
        let present = 0, absent = 0;
        dates.forEach(date => {
            if (records[date] && records[date][s.id]) {
                if (records[date][s.id] === 'hadir') present++; else absent++;
            }
        });
        const total = present + absent;
        const percent = total > 0 ? Math.round((present / total) * 100) : 0;
        return [i + 1, s.id, s.name, s.class, present, absent, total, `${percent}%`];
    });

    const startY = classFilter ? 54 : 48;

    doc.autoTable({
        startY: startY + 2,
        head: [['No.', 'No. ID', 'Nama', 'Kelas', 'Hadir', 'Tidak Hadir', 'Jumlah Hari', '% Kehadiran']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 }, 1: { cellWidth: 20 },
            4: { halign: 'center', cellWidth: 15 }, 5: { halign: 'center', cellWidth: 20 },
            6: { halign: 'center', cellWidth: 20 }, 7: { halign: 'center', cellWidth: 20 }
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        didParseCell: function (data) {
            if (data.column.index === 7 && data.section === 'body') {
                const val = parseInt(data.cell.raw);
                data.cell.styles.fontStyle = 'bold';
                if (val >= 80) data.cell.styles.textColor = [5, 150, 105];
                else if (val >= 50) data.cell.styles.textColor = [245, 158, 11];
                else data.cell.styles.textColor = [220, 38, 38];
            }
        }
    });
}

function exportStudentPDF(doc, students, records) {
    const studentId = document.getElementById('export-student-select').value;
    const student = students.find(s => s.id === studentId);

    if (!student) {
        showToast('Sila pilih pelajar.', 'error');
        return;
    }

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Nama Pelajar: ${student.name}`, 20, 42);
    doc.text(`No. ID: ${student.id}  |  Kelas: ${student.class}`, 20, 48);

    const allDates = Object.keys(records).sort();
    const tableData = [];
    let totalPresent = 0, totalAbsent = 0;

    allDates.forEach(date => {
        if (records[date][studentId]) {
            const status = records[date][studentId];
            if (status === 'hadir') totalPresent++; else totalAbsent++;
            tableData.push([tableData.length + 1, formatDate(date), status === 'hadir' ? 'HADIR' : 'TIDAK HADIR']);
        }
    });

    const totalDays = totalPresent + totalAbsent;
    const percent = totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : 0;

    doc.text(`Ringkasan: Hadir ${totalPresent} | Tidak Hadir ${totalAbsent} | Jumlah ${totalDays} hari | ${percent}% kehadiran`, 20, 56);

    if (tableData.length === 0) {
        doc.text('Tiada rekod kehadiran untuk pelajar ini.', 20, 66);
        return;
    }

    doc.autoTable({
        startY: 62,
        head: [['No.', 'Tarikh', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { halign: 'center', cellWidth: 15 }, 1: { cellWidth: 50 }, 2: { halign: 'center', cellWidth: 40 } },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        didParseCell: function (data) {
            if (data.column.index === 2 && data.section === 'body') {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = data.cell.raw === 'HADIR' ? [5, 150, 105] : [220, 38, 38];
            }
        }
    });
}

function updateExportPreview(type, students, records, classFilter) {
    const preview = document.getElementById('export-preview');

    if (type === 'daily') {
        const date = document.getElementById('export-daily-date').value;
        const dateRecords = records[date] || {};
        let filtered = students.filter(s => dateRecords[s.id]);
        if (classFilter) filtered = filtered.filter(s => s.class === classFilter);
        const presentCount = filtered.filter(s => dateRecords[s.id] === 'hadir').length;
        const absentCount = filtered.filter(s => dateRecords[s.id] === 'tidak hadir').length;

        preview.innerHTML = `
            <h4>Pratonton Laporan Harian - ${formatDate(date)}</h4>
            <p>Jumlah Pelajar: <strong>${filtered.length}</strong></p>
            <p>Hadir: <strong style="color:var(--success)">${presentCount}</strong> | 
               Tidak Hadir: <strong style="color:var(--danger)">${absentCount}</strong></p>
            <p>PDF telah dimuat turun.</p>`;
    } else if (type === 'range') {
        preview.innerHTML = `<h4>Laporan Tempoh</h4><p>PDF telah dimuat turun.</p>`;
    } else {
        const studentId = document.getElementById('export-student-select').value;
        const student = students.find(s => s.id === studentId);
        preview.innerHTML = `<h4>Laporan Individu - ${student ? student.name : ''}</h4><p>PDF telah dimuat turun.</p>`;
    }
}

// ====== UTILITY FUNCTIONS ======
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

// ====== MOBILE OVERLAY ======
function setupMobileOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebar-overlay';
    overlay.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        overlay.classList.remove('visible');
    });
    document.body.appendChild(overlay);

    window.toggleSidebar = function () {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
        overlay.classList.toggle('visible', sidebar.classList.contains('open'));
    };

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            overlay.classList.remove('visible');
        });
    });

    let touchStartX = 0;
    document.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    document.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        const diff = touchEndX - touchStartX;
        if (touchStartX < 30 && diff > 80) {
            document.getElementById('sidebar').classList.add('open');
            overlay.classList.add('visible');
        }
        if (diff < -80 && document.getElementById('sidebar').classList.contains('open')) {
            document.getElementById('sidebar').classList.remove('open');
            overlay.classList.remove('visible');
        }
    }, { passive: true });
}

// ====== INSTALL PROMPT (PWA) ======
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.createElement('button');
    installBtn.className = 'btn btn-primary install-btn';
    installBtn.innerHTML = '📲 Pasang Aplikasi';
    installBtn.addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(choice => {
            if (choice.outcome === 'accepted') showToast('Aplikasi berjaya dipasang!', 'success');
            deferredPrompt = null;
            installBtn.remove();
        });
    });
    const sidebar = document.querySelector('.sidebar-footer');
    if (sidebar) sidebar.prepend(installBtn);
});
