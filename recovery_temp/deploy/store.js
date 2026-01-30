const Store = {
    state: {
        students: [],
        fees: [],
        attendance: [],
        auditLogs: [],
        settings: {
            principalName: 'Mohamed Abdi',
            headTeachers: {
                "Form 1": "Mr. Ahmed Nur",
                "Form 2": "Ms. Fatima Farah",
                "Form 3": "Mr. Ali Gedi",
                "Form 4": "Ms. Aisha Dualeh"
            },
            messaging: {
                senderNumber: '0612373534',
                templates: {
                    reminder: '(waalidiinta qaaliga ah ee ardeyda dugsiga AL-HUDA , waxaaan idin xasuusineynaa in uu soo dhawaadey waqtigii lacag bixinta bisha , fadlan nagu soo hagaaji waqtigeeeda , mahadsanidiin)',
                    deadline: 'waalidiinta qaaliga ah ee ardeyda dugsiga AL-HUDA , waxaaan idin ogeysiineynaa in lajoogo waqtigii lacag bixinta bisha , fadlan nagu soo hagaaji marka aad awoodan , mahadsanidiin.'
                }
            }
        },
        currentUser: null,
        dataVersion: 4
    },

    init() {
        this.loadFromStorage();
        // Force re-seed for new version with expanded fields
        if (this.state.students.length < 50 || !this.state.dataVersion || this.state.dataVersion < 4) {
            this.state.students = [];
            this.state.fees = [];
            this.state.attendance = [];
            this.state.auditLogs = [];
            this.seedData();
        }
    },

    loadFromStorage() {
        const stored = localStorage.getItem('dugsiga_data');
        if (stored) {
            this.state = JSON.parse(stored);
        }
    },

    saveToStorage() {
        localStorage.setItem('dugsiga_data', JSON.stringify(this.state));
    },

    // --- Audit Logs ---
    logAction(action, details, user = 'System') {
        const entry = {
            id: 'LOG-' + Date.now(),
            timestamp: new Date().toISOString(),
            user,
            action,
            details
        };
        this.state.auditLogs.unshift(entry);
        if (this.state.auditLogs.length > 100) this.state.auditLogs.pop(); // Keep last 100
        this.saveToStorage();
    },

    getAuditLogs() {
        return this.state.auditLogs;
    },

    // --- Students ---
    getStudents() {
        return this.state.students;
    },

    getStudent(id) {
        return this.state.students.find(s => s.id === id);
    },

    addStudent(student) {
        const newStudent = {
            id: "STU-" + Date.now().toString().slice(-6),
            isActive: true,
            enrollmentDate: new Date().toISOString().split('T')[0],
            section: student.section || 'A',
            dorm: student.dorm || 'Dorm 1',
            isFree: student.isFree || false,
            performanceRemarks: '',
            ...student
        };
        this.state.students.push(newStudent);
        this.logAction('Add Student', `Added student ${newStudent.fullName}`, sessionStorage.getItem('dugsiga_user') ? JSON.parse(sessionStorage.getItem('dugsiga_user')).username : 'System');
        this.saveToStorage();
        return newStudent;
    },

    updateStudent(updatedData) {
        const index = this.state.students.findIndex(s => s.id === updatedData.id);
        if (index !== -1) {
            this.state.students[index] = { ...this.state.students[index], ...updatedData };
            this.logAction('Update Student', `Updated student ${updatedData.fullName}`, sessionStorage.getItem('dugsiga_user') ? JSON.parse(sessionStorage.getItem('dugsiga_user')).username : 'System');
            this.saveToStorage();
            return true;
        }
        return false;
    },

    // --- Fees ---
    getFees() {
        return this.state.fees;
    },

    toggleFeeStatus(feeId) {
        const fee = this.state.fees.find(f => f.id === feeId);
        if (fee) {
            const oldStatus = fee.status;
            // Simple toggle between PAID and UNPAID as per user request
            fee.status = (fee.status === 'PAID') ? 'UNPAID' : 'PAID';
            fee.amountPaid = fee.status === 'PAID' ? fee.amount : 0;
            fee.datePaid = fee.status === 'PAID' ? new Date().toISOString() : null;

            this.logAction('Update Fee', `Changed fee ${feeId} status from ${oldStatus} to ${fee.status}`, sessionStorage.getItem('dugsiga_user') ? JSON.parse(sessionStorage.getItem('dugsiga_user')).username : 'System');
            this.saveToStorage();
        }
    },

    // --- Settings ---
    getSettings() {
        if (!this.state.settings) {
            this.state.settings = {
                principalName: 'Sheikh Hassan Ali',
                headTeachers: { "Form 1": "Mr. Ahmed Nur", "Form 2": "Ms. Fatima Farah", "Form 3": "Mr. Ali Gedi", "Form 4": "Ms. Aisha Dualeh" }
            };
        }
        return this.state.settings;
    },

    updateSettings(newSettings) {
        this.state.settings = { ...this.state.settings, ...newSettings };
        this.logAction('Settings Update', 'Updated school leadership settings', sessionStorage.getItem('dugsiga_user') ? JSON.parse(sessionStorage.getItem('dugsiga_user')).username : 'System');
        this.saveToStorage();
    },

    // --- Messaging ---
    sendMessage(phone, message, sender) {
        // Simulation: Just log to audit
        this.logAction('SMS Simulation', `Sent to ${phone} from ${sender}: ${message.substring(0, 30)}...`, sessionStorage.getItem('dugsiga_user') ? JSON.parse(sessionStorage.getItem('dugsiga_user')).username : 'System');
        return true;
    },

    // --- Attendance ---
    getAttendance() {
        return this.state.attendance;
    },

    recordAttendance(studentId, status, date) {
        const existingIndex = this.state.attendance.findIndex(
            a => a.studentId === studentId && a.date === date
        );

        if (existingIndex >= 0) {
            this.state.attendance[existingIndex].status = status;
        } else {
            this.state.attendance.push({ studentId, date, status });
        }
        this.logAction('Attendance', `Marked ${studentId} as ${status} for ${date}`, sessionStorage.getItem('dugsiga_user') ? JSON.parse(sessionStorage.getItem('dugsiga_user')).username : 'System');
        this.saveToStorage();
    },

    getStudentAttendanceStats(studentId) {
        const records = this.state.attendance.filter(a => a.studentId === studentId);
        const present = records.filter(a => a.status === 'Present').length;
        const total = records.length;
        return total === 0 ? 0 : Math.round((present / total) * 100);
    },

    // --- Seeding ---
    seedData() {
        this.state.dataVersion = 4;
        this.state.settings = {
            principalName: 'Mohamed Abdi',
            headTeachers: {
                "Form 1": "Mr. Ahmed Nur",
                "Form 2": "Ms. Fatima Farah",
                "Form 3": "Mr. Ali Gedi",
                "Form 4": "Ms. Aisha Dualeh"
            },
            messaging: {
                senderNumber: '0612373534',
                templates: {
                    reminder: '(waalidiinta qaaliga ah ee ardeyda dugsiga AL-HUDA , waxaaan idin xasuusineynaa in uu soo dhawaadey waqtigii lacag bixinta bisha , fadlan nagu soo hagaaji waqtigeeeda , mahadsanidiin)',
                    deadline: 'waalidiinta qaaliga ah ee ardeyda dugsiga AL-HUDA , waxaaan idin ogeysiineynaa in lajoogo waqtigii lacag bixinta bisha , fadlan nagu soo hagaaji marka aad awoodan , mahadsanidiin.'
                }
            }
        };

        const firstNames = [
            "Ahmed", "Mohamed", "Ali", "Hassan", "Yusuf", "Ibrahim", "Abdi", "Omar", "Osman", "Khalid",
            "Fatima", "Aisha", "Khadija", "Mariam", "Leyla", "Zahra", "Hibo", "Sahra", "Naima", "Fowzia"
        ];
        const lastNames = [
            "Nur", "Farah", "Gedi", "Warsame", "Dualeh", "Abdi", "Hassan", "Ali", "Mohamed", "Omar"
        ];

        const GRADES = ["Form 1", "Form 2", "Form 3", "Form 4"];
        const SECTIONS = ["A", "B"];
        const DORMS = ["Dorm 1", "Dorm 2", "Dorm 3", "Dorm 4"];
        let idCounter = 1000;

        GRADES.forEach(grade => {
            SECTIONS.forEach(section => {
                for (let i = 0; i < 15; i++) {
                    const fname = firstNames[Math.floor(Math.random() * firstNames.length)];
                    const lname = lastNames[Math.floor(Math.random() * lastNames.length)];

                    // Assign dorms based on index to ensure even distribution
                    const dorm = DORMS[Math.floor(Math.random() * DORMS.length)];
                    // Randomly make some students "Free" (1 in 10)
                    const isFree = Math.random() > 0.9;

                    const student = {
                        id: `STU-${idCounter++}`,
                        fullName: `${fname} ${lname} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
                        grade: grade,
                        section: section,
                        dorm: dorm,
                        isFree: isFree,
                        parentName: `${lname} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
                        parentPhone: `615-${100000 + Math.floor(Math.random() * 900000)}`,
                        enrollmentDate: "2024-09-01",
                        isActive: true,
                        performanceRemarks: i % 5 === 0 ? 'Excellent progress' : ''
                    };
                    this.state.students.push(student);
                }
            });
        });

        // Seed Attendance (Last 15 days)
        const today = new Date();
        const dates = [];
        for (let i = 0; i < 15; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }

        this.state.students.forEach(s => {
            dates.forEach(date => {
                const rand = Math.random();
                let status = "Present";
                if (rand > 0.90) status = "Absent";
                else if (rand > 0.82) status = "Late";
                this.state.attendance.push({ studentId: s.id, date: date, status: status });
            });
        });

        // Seed Fees - strictly PAID or UNPAID
        const MONTHS = ["January", "February", "March"];
        this.state.students.forEach(s => {
            if (s.isFree) return; // Skip free students for fees

            MONTHS.forEach((month, idx) => {
                const isPaid = Math.random() > 0.4;
                this.state.fees.push({
                    id: "FEE-" + Math.random().toString(36).substr(2, 6).toUpperCase(),
                    studentId: s.id,
                    month: month,
                    amount: 50,
                    amountPaid: isPaid ? 50 : 0,
                    status: isPaid ? "PAID" : "UNPAID",
                    dueDate: `2026-0${idx + 1}-05`
                });
            });
        });

        this.logAction('System', 'Database initialized with AL-Huda data version 4 (Dorms & Settings)');
        this.saveToStorage();
    },

    exportData() {
        return JSON.stringify(this.state);
    },

    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.state = data;
            this.saveToStorage();
            return true;
        } catch (e) {
            console.error('Invalid import data', e);
            return false;
        }
    },
};

window.Store = Store;
