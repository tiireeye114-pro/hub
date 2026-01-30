const App = {
    state: {
        currentView: 'dashboard',
        currentStudentId: null,
        activeProfileTab: 'overview', // overview, attendance, fees
        currentStudentGrade: null,
        currentStudentSection: null,
        currentAttendanceGrade: null,
        currentAttendanceSection: null,
        currentAttendanceMonth: null, // "2026-01", "2026-02", etc.
        currentFeeGrade: null,
        currentFeeSection: null,
        currentFeeMonth: null,
        currentMessagingGrade: null,
        currentMessagingSection: null,
        showFreeStudents: false,
        currentUserRole: null // 'admin' or 'teacher'
    },

    init() {
        Store.init();
        this.checkAuth();
        this.setupEventListeners();
    },

    checkAuth() {
        const user = JSON.parse(sessionStorage.getItem('dugsiga_user'));
        if (user && user.role) {
            this.state.currentUserRole = user.role;
            this.showLayout();
        } else {
            this.showLogin();
        }
    },

    setupEventListeners() {
        // Login
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const u = document.getElementById('username').value.trim().toLowerCase();
            const p = document.getElementById('password').value;

            if (u === 'admin' && p === '123') {
                const session = { role: 'admin', username: 'admin' };
                sessionStorage.setItem('dugsiga_user', JSON.stringify(session));
                this.state.currentUserRole = 'admin';
                this.showLayout();
            } else if (u === 'teacher' && p === 'abc') {
                const session = { role: 'teacher', username: 'teacher' };
                sessionStorage.setItem('dugsiga_user', JSON.stringify(session));
                this.state.currentUserRole = 'teacher';
                this.showLayout();
            } else {
                alert(`Invalid Credentials! You entered: ${u}. Try: admin/123 or teacher/abc`);
            }
        });

        // Navigation
        document.querySelectorAll('.nav-item[data-view]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(link.dataset.view);
            });
        });

        // Logout
        if (!document.getElementById('logout-btn-container')) {
            document.querySelector('.sidebar').insertAdjacentHTML('beforeend', `
                <div id="logout-btn-container" style="margin-top: auto; padding-top: 1rem; border-top: 1px solid #374151;">
                    <button id="logout-btn" class="nav-item w-full" style="color: #ef4444; background: none; border: none; cursor: pointer;">
                        <i data-feather="log-out"></i>
                        Logout
                    </button>
                </div>
            `);
            document.getElementById('logout-btn').addEventListener('click', () => {
                sessionStorage.removeItem('dugsiga_user');
                window.location.reload();
            });
        }

        // Modals
        const closeModals = (id) => this.toggleModal(id, false);
        ['modal-container', 'edit-student-modal', 'att-modal-container'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', (e) => { if (e.target === el) closeModals(id); });
                const closeBtn = el.querySelector('button[id^="close"]');
                if (closeBtn) closeBtn.addEventListener('click', () => closeModals(id));
                const cancelBtn = el.querySelector('button[id^="cancel"]');
                if (cancelBtn) cancelBtn.addEventListener('click', () => closeModals(id));
            }
        });

        document.getElementById('add-student-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            Store.addStudent({
                fullName: formData.get('fullName'),
                grade: formData.get('grade'),
                parentName: formData.get('parentName'),
                parentPhone: formData.get('parentPhone')
            });
            this.toggleModal('modal-container', false);
            e.target.reset();
            this.showToast('Student added successfully!');
            this.refreshCurrentView();
        });

        document.getElementById('edit-student-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            Store.updateStudent({
                id: formData.get('id'),
                fullName: formData.get('fullName'),
                grade: formData.get('grade'),
                parentName: formData.get('parentName'),
                parentPhone: formData.get('parentPhone')
            });
            this.toggleModal('edit-student-modal', false);
            this.showToast('Student updated successfully!');
            this.refreshCurrentView();
        });

        document.getElementById('update-att-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            Store.recordAttendance(formData.get('studentId'), formData.get('status'), formData.get('date'));
            this.toggleModal('att-modal-container', false);
            this.showToast('Attendance updated!');
            this.refreshCurrentView();
        });

        document.getElementById('att-date').addEventListener('change', (e) => {
            const studentId = document.getElementById('att-student-id').value;
            this.updateModalStatusSelection(studentId, e.target.value);
        });

        // Sidebar Toggle
        const toggleBtn = document.getElementById('sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');

        const toggleSidebar = (show) => {
            if (show) {
                sidebar.classList.add('open');
                backdrop.classList.remove('hidden');
            } else {
                sidebar.classList.remove('open');
                backdrop.classList.add('hidden');
            }
        };

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => toggleSidebar(!sidebar.classList.contains('open')));
        }

        if (backdrop) {
            backdrop.addEventListener('click', () => toggleSidebar(false));
        }

        // Close sidebar on link click (mobile)
        document.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) toggleSidebar(false);
            });
        });
    },

    toggleModal(modalId, show) {
        const modal = document.getElementById(modalId);
        if (show) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
    },

    openEditStudentModal(studentId) {
        const student = Store.getStudent(studentId);
        if (!student) return;
        document.getElementById('edit-id').value = student.id;
        document.getElementById('edit-fullName').value = student.fullName;
        document.getElementById('edit-grade').value = student.grade;
        document.getElementById('edit-parentName').value = student.parentName;
        document.getElementById('edit-parentPhone').value = student.parentPhone;
        this.toggleModal('edit-student-modal', true);
    },

    openAttendanceModal(studentId, studentName) {
        document.getElementById('att-student-id').value = studentId;
        document.getElementById('att-modal-title').textContent = `Update Attendance: ${studentName}`;
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('att-date').value = today;
        this.updateModalStatusSelection(studentId, today);
        this.toggleModal('att-modal-container', true);
    },

    updateModalStatusSelection(studentId, date) {
        const attendance = Store.getAttendance();
        const record = attendance.find(a => a.studentId === studentId && a.date === date);
        const status = record ? record.status : 'Present';
        document.querySelectorAll('#update-att-form input[name="status"]').forEach(r => r.checked = false);
        const radio = document.querySelector(`#update-att-form input[name="status"][value="${status}"]`);
        if (radio) radio.checked = true;
    },

    showToast(message) {
        const toast = document.getElementById('toast');
        document.getElementById('toast-message').textContent = message;
        toast.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
    },

    showLogin() {
        document.getElementById('login-view').classList.remove('hidden');
        document.getElementById('app-layout').classList.add('hidden');
    },

    showLayout() {
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('app-layout').classList.remove('hidden');

        // RBAC: Hide elements based on role
        if (this.state.currentUserRole === 'teacher') {
            document.querySelector('.nav-item[data-view="dashboard"]').style.display = 'none';
            document.querySelector('.nav-item[data-view="fees"]').style.display = 'none';
            document.querySelector('.nav-item[data-view="data-management"]').style.display = 'none';
            // reports is not in the sidebar yet, but just in case
            const reportLink = document.querySelector('.nav-item[data-view="reports"]');
            if (reportLink) reportLink.style.display = 'none';

            this.navigateTo('students'); // Teachers start at students
        } else {
            // Admin: Show all
            document.querySelectorAll('.nav-item').forEach(el => el.style.display = 'flex');
            this.navigateTo('dashboard');
        }
    },

    refreshCurrentView() {
        // RBAC Check for View Access (Anti-Tamper)
        if (this.state.currentUserRole === 'teacher') {
            const restricted = ['dashboard', 'fees', 'reports', 'data-management'];
            if (restricted.includes(this.state.currentView)) {
                this.navigateTo('students');
                return;
            }
        }

        if (this.state.currentView === 'student-profile') {
            this.showStudentProfile(this.state.currentStudentId);
            return;
        }

        const area = document.getElementById('main-content-area');
        const view = this.state.currentView;

        if (view === 'parent-messages') {
            this.renderParentMessages(area);
        } else if (view === 'free-fee-students') {
            this.renderFreeStudents(area);
        } else if (view === 'data-management') {
            this.renderDataManagement(area);
        } else if (this[`render${view.charAt(0).toUpperCase() + view.slice(1)}`]) {
            this[`render${view.charAt(0).toUpperCase() + view.slice(1)}`](area);
        }
        feather.replace();
    },

    navigateTo(viewName) {
        this.state.currentView = viewName;
        // Navigation resets
        if (viewName !== 'students') {
            this.state.currentStudentGrade = null;
            this.state.currentStudentSection = null;
        }
        if (viewName !== 'attendance') {
            this.state.currentAttendanceGrade = null;
            this.state.currentAttendanceSection = null;
            this.state.currentAttendanceMonth = null;
        }
        if (viewName !== 'fees') {
            this.state.currentFeeGrade = null;
            this.state.currentFeeSection = null;
            this.state.currentFeeMonth = null;
        }
        if (viewName !== 'parent-messages') {
            this.state.currentMessagingGrade = null;
            this.state.currentMessagingSection = null;
        }

        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-item[data-view="${viewName}"]`);
        if (activeLink) activeLink.classList.add('active');

        document.getElementById('page-title').textContent = {
            'dashboard': 'Dashboard',
            'students': 'Students Directory',
            'attendance': 'Attendance',
            'fees': 'Fees Management',
            'free-fee-students': 'Free Fee Students',
            'reports': 'Reports',
            'messaging': 'Messaging',
            'parent-messages': 'Private Parent Messages'
        }[viewName] || 'Dashboard';

        this.refreshCurrentView();
    },

    // --- Profile Logic ---
    showStudentProfile(studentId) {
        this.state.currentView = 'student-profile';
        this.state.currentStudentId = studentId;
        if (!this.state.activeProfileTab) this.state.activeProfileTab = 'overview';

        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        // Keep Students nav active visually as we are deep in that section
        const stuLink = document.querySelector(`.nav-item[data-view="students"]`);
        if (stuLink) stuLink.classList.add('active');

        document.getElementById('page-title').textContent = 'Student Profile';

        const content = document.getElementById('main-content-area');
        this.renderStudentProfile(content, studentId);
        feather.replace();
    },

    switchProfileTab(tab) {
        this.state.activeProfileTab = tab;
        this.showStudentProfile(this.state.currentStudentId);
    },

    renderStudentProfile(container, studentId) {
        const student = Store.getStudent(studentId);
        if (!student) {
            container.innerHTML = '<p>Student not found.</p>';
            return;
        }

        const activeTab = this.state.activeProfileTab;
        const tabClass = (name) => `
            cursor: pointer; 
            padding: 1rem 0; 
            margin-right: 2rem; 
            font-weight: 500; 
            color: ${activeTab === name ? '#f97316' : '#6b7280'}; 
            border-bottom: 2px solid ${activeTab === name ? '#f97316' : 'transparent'};
        `;

        // If we came from a specific class folder, back button should go there, else general
        const backAction = this.state.currentStudentGrade ? "App.renderStudents(document.getElementById('main-content-area'))" : "App.navigateTo('students')";

        // RBAC: Edit Button visibility
        const editButton = (this.state.currentUserRole === 'admin' || this.state.currentUserRole === 'teacher') ? `
            <button class="btn" onclick="App.openEditStudentModal('${student.id}')" style="border: 1px solid #e5e7eb; padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.875rem; color: #374151;">
                <i data-feather="edit-2" style="width: 14px; margin-right: 6px;"></i> Edit
            </button>
        ` : '';

        // RBAC: Fees Tab visibility
        const feesTab = this.state.currentUserRole === 'admin' ? `
            <div onclick="App.switchProfileTab('fees')" style="${tabClass('fees')}">Fee History</div>
        ` : '';

        container.innerHTML = `
            <div style="max-width: 1200px; margin: 0 auto;">
                <button onclick="${backAction}" class="btn" style="margin-bottom: 1rem; background: transparent; color: #6b7280; padding-left: 0;">
                    <i data-feather="arrow-left" style="width: 16px; height: 16px; vertical-align: middle;"></i> Back to List
                </button>

                <div style="background: white; border-radius: 12px; padding: 1.5rem 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 1.5rem; align-items: center;">
                        <div style="width: 64px; height: 64px; background: #111827; color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.75rem; font-weight: 600;">
                            ${student.fullName.charAt(0)}
                        </div>
                        <div>
                            <h2 style="font-size: 1.25rem; font-weight: 700; color: #111827; margin-bottom: 0.25rem;">${student.fullName}</h2>
                            <p style="color: #6b7280; font-size: 0.875rem;">${student.grade} • ID: ${student.id}</p>
                        </div>
                    </div>
                    ${editButton}
                </div>

                <div style="border-bottom: 1px solid #e5e7eb; margin-bottom: 2rem; display: flex;">
                    <div onclick="App.switchProfileTab('overview')" style="${tabClass('overview')}">Overview</div>
                    <div onclick="App.switchProfileTab('attendance')" style="${tabClass('attendance')}">Attendance</div>
                    ${feesTab}
                </div>

                <div id="profile-tab-content">
                    ${this.getProfileTabContent(student)}
                </div>
            </div>
        `;
    },

    getProfileTabContent(student) {
        const attendance = Store.getAttendance().filter(a => a.studentId === student.id);
        const fees = Store.getFees().filter(f => f.studentId === student.id);

        switch (this.state.activeProfileTab) {
            case 'overview': return this.renderTabOverview(student, attendance);
            case 'attendance': return this.renderTabAttendance(attendance);
            case 'fees': return this.renderTabFees(fees);
            default: return this.renderTabOverview(student, attendance);
        }
    },

    renderTabOverview(student, attendance) {
        const present = attendance.filter(a => a.status === 'Present').length;
        const absent = attendance.filter(a => a.status === 'Absent').length;
        const late = attendance.filter(a => a.status === 'Late').length;

        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                <div style="background: white; border-radius: 12px; padding: 1.5rem; border: 1px solid #f3f4f6;">
                    <h3 style="font-weight: 700; margin-bottom: 1rem; color: #111827; font-size: 1rem;">Personal Information</h3>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f9fafb; padding-bottom:8px;">
                            <span style="color:#6b7280; font-size:0.85rem;">Section</span>
                            <span style="font-weight:600; color:#111827;">${student.section}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f9fafb; padding-bottom:8px;">
                            <span style="color:#6b7280; font-size:0.85rem;">Parent Name</span>
                            <span style="font-weight:600; color:#111827;">${student.parentName}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f9fafb; padding-bottom:8px;">
                            <span style="color:#6b7280; font-size:0.85rem;">Guardian Phone</span>
                            <span style="font-weight:600; color:#111827;">${student.parentPhone}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#6b7280; font-size:0.85rem;">Admission Date</span>
                            <span style="font-weight:600; color:#111827;">${student.enrollmentDate}</span>
                        </div>
                    </div>
                </div>

                <div style="background: white; border-radius: 12px; padding: 1.5rem; border: 1px solid #f3f4f6;">
                    <h3 style="font-weight: 700; margin-bottom: 1.5rem; color: #111827; font-size: 1rem;">Performance Remarks</h3>
                    <div style="background: #fdf2f8; border-radius: 8px; padding: 1rem; border-left: 4px solid #db2777;">
                        <p style="font-size: 0.9rem; color: #9d174d; line-height: 1.5;">
                            ${student.performanceRemarks || 'No remarks recorded for this term yet.'}
                        </p>
                    </div>
                    <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
                        <div style="flex:1; text-align:center;">
                            <div style="font-size:1.25rem; font-weight:700; color:#10b981;">${present}</div>
                            <div style="font-size:0.75rem; color:#6b7280;">Present</div>
                        </div>
                        <div style="flex:1; text-align:center;">
                            <div style="font-size:1.25rem; font-weight:700; color:#ef4444;">${absent}</div>
                            <div style="font-size:0.75rem; color:#6b7280;">Absent</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderTabAttendance(attendance) {
        const total = attendance.length;
        const present = attendance.filter(a => a.status === 'Present').length;
        const late = attendance.filter(a => a.status === 'Late').length;
        const rate = total ? Math.round((present / total) * 100) : 0;

        const days = [];
        for (let i = 14; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const record = attendance.find(a => a.date === dateStr);
            days.push({ date: dateStr, status: record ? record.status : 'None' });
        }

        return `
            <div style="background: white; border-radius: 12px; padding: 1.5rem; border: 1px solid #f3f4f6;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="font-weight: 700; color: #111827; font-size: 1rem;">Attendance (Last 15 Days)</h3>
                    <div style="background: #ecfdf5; color: #059669; padding: 4px 12px; border-radius: 12px; font-weight: 600; font-size: 0.75rem;">${rate}% Overall Rate</div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 8px; margin-bottom: 1.5rem;">
                    ${days.map(d => {
            let color = '#f9fafb';
            let textColor = '#6b7280';
            if (d.status === 'Present') { color = '#ecfdf5'; textColor = '#059669'; }
            if (d.status === 'Absent') { color = '#fef2f2'; textColor = '#dc2626'; }
            if (d.status === 'Late') { color = '#fffbeb'; textColor = '#d97706'; }

            return `
                            <div style="background:${color}; color:${textColor}; padding:8px; border-radius:8px; text-align:center; border:1px solid rgba(0,0,0,0.03);">
                                <div style="font-size:0.6rem; margin-bottom:4px;">${d.date.slice(5)}</div>
                                <div style="font-weight:700; font-size:0.8rem;">${d.status.charAt(0)}</div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    },

    renderTabFees(fees) {
        return `
            <div style="background: white; border-radius: 12px; padding: 1.5rem; border: 1px solid #f3f4f6;">
                <h3 style="font-weight: 700; color: #111827; margin-bottom: 1rem; font-size: 1rem;">Fee Payments</h3>
                <div style="overflow-x: auto;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th style="font-size:0.75rem; color:#6b7280;">MONTH</th>
                                <th style="font-size:0.75rem; color:#6b7280;">DUE</th>
                                <th style="font-size:0.75rem; color:#6b7280;">PAID</th>
                                <th style="font-size:0.75rem; color:#6b7280;">STATUS</th>
                                <th style="font-size:0.75rem; color:#6b7280; text-align:right;">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${fees.map(f => {
            let statusColor = '#3b82f6';
            let statusBg = '#eff6ff';
            if (f.status === 'PAID') { statusColor = '#059669'; statusBg = '#ecfdf5'; }
            if (f.status === 'OVERDUE') { statusColor = '#dc2626'; statusBg = '#fef2f2'; }
            if (f.status === 'PENDING') { statusColor = '#d97706'; statusBg = '#fffbeb'; }

            return `
                                <tr>
                                    <td style="font-weight:600; color:#1f2937;">${f.month}</td>
                                    <td style="color:#6b7280;">$${f.amount}</td>
                                    <td style="font-weight:600; color:#111827;">$${f.amountPaid || 0}</td>
                                    <td>
                                        <span style="background:${statusBg}; color:${statusColor}; padding:2px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">
                                            ${f.status}
                                        </span>
                                    </td>
                                    <td style="text-align:right;">
                                        <button class="btn" onclick="App.toggleFeeStatus('${f.id}')" style="background:none; border:none; color:#6366f1; font-weight:600; padding:0; font-size:0.8rem; cursor:pointer;">Update</button>
                                    </td>
                                </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
                ${fees.filter(f => f.status !== 'PAID').length > 0 ? `
                    <div style="margin-top:1.5rem; padding:1rem; background:#fffbeb; border:1px dashed #f59e0b; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.85rem; color:#92400e;">Automated reminders can be sent for unpaid months.</span>
                        <button onclick="App.sendReminder('${fees[0].studentId}')" style="background:#f59e0b; color:white; border:none; padding:6px 16px; border-radius:6px; font-size:0.8rem; font-weight:600; cursor:pointer;">Send Alert</button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    sendReminder(stuId) {
        this.showToast('Reminder sent to parent successfully!');
        Store.logAction('Fee Alert', `Sent payment reminder for student ${stuId}`, JSON.parse(sessionStorage.getItem('dugsiga_user')).username);
    },

    // --- Views ---

    renderDashboard(container) {
        const students = Store.getStudents();
        const fees = Store.getFees();
        const attendance = Store.getAttendance();

        // Calculate Revenue (Sum of amountPaid)
        const collectedRevenue = fees.filter(f => f.status === 'PAID').reduce((sum, f) => sum + (f.amountPaid || 0), 0);
        // Calculate Expected Revenue (Total non-free students * 20 * 3 months)
        const payingStudents = students.filter(s => !s.isFree).length;
        const expectedRevenue = payingStudents * 20 * 3; // 3 months are seeded

        container.innerHTML = `
            <div style="animation: fadeIn 0.8s ease-out; max-width: 1400px; margin: 0 auto;">
                <!-- Header Stats -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                    <div class="glass-card" style="padding: 1.5rem; display: flex; align-items: center; gap: 1.25rem; border: none; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                        <div style="width: 48px; height: 48px; background: #f3f4f6; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #4b5563;">
                            <i data-feather="users" style="width: 20px; height: 20px;"></i>
                        </div>
                        <div>
                            <p style="color: #6b7280; font-size: 0.8rem; font-weight: 500; margin-bottom: 2px;">Total Students</p>
                            <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">${students.length}</h2>
                        </div>
                    </div>
                    <div class="glass-card" style="padding: 1.5rem; display: flex; align-items: center; gap: 1.25rem; border: none; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                        <div style="width: 48px; height: 48px; background: #f0fdf4; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #10b981;">
                            <i data-feather="dollar-sign" style="width: 20px; height: 20px;"></i>
                        </div>
                        <div>
                            <p style="color: #6b7280; font-size: 0.8rem; font-weight: 500; margin-bottom: 2px;">Collected Revenue</p>
                            <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">$${collectedRevenue}</h2>
                        </div>
                    </div>
                    <div class="glass-card" style="padding: 1.5rem; display: flex; align-items: center; gap: 1.25rem; border: none; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                        <div style="width: 48px; height: 48px; background: #eff6ff; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #3b82f6;">
                            <i data-feather="trending-up" style="width: 20px; height: 20px;"></i>
                        </div>
                        <div>
                            <p style="color: #6b7280; font-size: 0.8rem; font-weight: 500; margin-bottom: 2px;">Expected Revenue</p>
                            <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">$${expectedRevenue}</h2>
                        </div>
                    </div>
                </div>

                <!-- Main Charts Row -->
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
                    <!-- Line Chart -->
                    <div class="glass-card" style="padding: 1.5rem; border: none; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                        <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 2rem; color: #111827;">Financial Overview</h3>
                        <div style="height: 350px; position: relative;">
                            <canvas id="revenueChart"></canvas>
                        </div>
                    </div>

                    <!-- Attendance Chart -->
                    <div class="glass-card" style="padding: 1.5rem; border: none; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                        <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 2rem; color: #111827;">Attendance Today</h3>
                        <div style="height: 280px; position: relative;">
                            <canvas id="attendanceChart"></canvas>
                        </div>
                        <div id="attendance-legend" style="margin-top: 1.5rem; display: flex; justify-content: space-around; font-size: 0.75rem; font-weight: 600;">
                            <div style="display:flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; background:#10b981; border-radius:50%;"></span> Present</div>
                            <div style="display:flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; background:#ef4444; border-radius:50%;"></span> Absent</div>
                            <div style="display:flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; background:#f59e0b; border-radius:50%;"></span> Late</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        feather.replace();

        // Use a timeout to ensure canvas is ready in DOM
        setTimeout(() => {
            this.initDashboardCharts(attendance);
        }, 50);
    },

    initDashboardCharts(allAttendance) {
        // Line Chart (Financial Overview)
        const revCanvas = document.getElementById('revenueChart');
        if (revCanvas) {
            const revCtx = revCanvas.getContext('2d');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
            const revenueData = [1200, 1900, 3000, 500, 2000, 100];

            new Chart(revCtx, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Revenue',
                        data: revenueData,
                        borderColor: '#111827',
                        backgroundColor: 'rgba(17, 24, 39, 0.05)',
                        borderWidth: 2,
                        pointBackgroundColor: '#111827',
                        pointRadius: 4,
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false } },
                        y: {
                            beginAtZero: true,
                            grid: { color: '#f3f4f6' },
                            ticks: { stepSize: 500 }
                        }
                    }
                }
            });
        }

        // Attendance Today Doughnut
        const attCanvas = document.getElementById('attendanceChart');
        if (attCanvas) {
            const attCtx = attCanvas.getContext('2d');
            const today = new Date().toISOString().split('T')[0];
            const todayRecs = allAttendance.filter(a => a.date === today);

            const counts = {
                Present: todayRecs.filter(r => r.status === 'Present').length,
                Absent: todayRecs.filter(r => r.status === 'Absent').length,
                Late: todayRecs.filter(r => r.status === 'Late').length
            };

            // Placeholder for visual match if no data
            if (todayRecs.length === 0) {
                counts.Present = 85;
                counts.Absent = 15;
                counts.Late = 10;
            }

            new Chart(attCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Present', 'Absent', 'Late'],
                    datasets: [{
                        data: [counts.Present, counts.Absent, counts.Late],
                        backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: { legend: { display: false } }
                }
            });
        }
    },

    openClassFolder(grade) {
        this.state.currentStudentGrade = grade;
        this.state.currentStudentSection = null;
        this.refreshCurrentView();
    },

    openClassSection(section) {
        this.state.currentStudentSection = section;
        this.refreshCurrentView();
    },

    closeClassFolder() {
        if (this.state.currentStudentSection) {
            this.state.currentStudentSection = null;
        } else {
            this.state.currentStudentGrade = null;
        }
        this.refreshCurrentView();
    },

    renderStudents(container) {
        if (!this.state.currentStudentGrade) {
            this.renderClassFolders(container);
        } else if (!this.state.currentStudentSection) {
            this.renderClassSections(container);
        } else {
            this.renderStudentList(container);
        }
    },

    renderClassSections(container) {
        const grade = this.state.currentStudentGrade;
        const sections = ["A", "B"];
        const students = Store.getStudents();

        container.innerHTML = `
            <div>
                <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 2rem;">
                    <button onclick="App.closeClassFolder()" class="btn glass-card" style="padding: 0.5rem;"><i data-feather="arrow-left"></i></button>
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">${grade} Sections</h2>
                        <p style="color: #6b7280; font-size: 0.85rem;">Select a section to view the student list.</p>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem;">
                    ${sections.map(sec => {
            const count = students.filter(s => s.grade === grade && s.section === sec).length;
            return `
                        <div onclick="App.openClassSection('${sec}')" class="glass-card" style="padding: 2rem; cursor: pointer; text-align: center; border: 1px solid #f3f4f6;">
                             <div style="width: 54px; height: 54px; background: #eff6ff; color: #3b82f6; border-radius: 12px; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center;">
                                <i data-feather="users"></i>
                            </div>
                            <h4 style="font-weight: 700; color: #111827; margin-bottom: 4px;">Section ${sec}</h4>
                            <p style="color: #6b7280; font-size: 0.75rem;">${count} Students</p>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
        feather.replace();
    },

    renderStudentList(container) {
        const grade = this.state.currentStudentGrade;
        const section = this.state.currentStudentSection;
        const students = Store.getStudents()
            .filter(s => s.grade === grade && s.section === section)
            .sort((a, b) => a.listNumber - b.listNumber);

        // RBAC: Add Student Button
        const addStudentBtn = (this.state.currentUserRole === 'admin' || this.state.currentUserRole === 'teacher') ?
            `<button class="btn btn-primary" onclick="App.toggleModal('modal-container', true)">+ Add Student</button>` : '';

        container.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem;">
                    <button onclick="App.closeClassFolder()" class="btn" style="background: white; border: 1px solid #e5e7eb; color: #374151; padding: 0.5rem;">
                        <i data-feather="arrow-left"></i>
                    </button>
                    <h3 style="font-size: 1.25rem; font-weight: 700; color: #1f2937;">${this.state.currentStudentGrade} - Section ${section}</h3>
                    <span style="background: #f3f4f6; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; color: #6b7280;">${students.length} Students</span>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <input type="text" placeholder="Search students..." class="form-input" id="search-student" style="max-width:300px;">
                    ${addStudentBtn}
                </div>

                <div style="overflow-x: auto;">
                    <table class="table">
                        <thead><tr><th style="width: 50px;">#</th><th>Name</th><th>Parent Info</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody id="student-table-body">
                            ${students.map(s => {
            // RBAC: Edit Button
            const editBtn = (this.state.currentUserRole === 'admin' || this.state.currentUserRole === 'teacher') ? `
                                    <button class="btn" onclick="App.openEditStudentModal('${s.id}')"
                                    style="color: #6b7280; background: none; border: none; font-weight: 500; cursor: pointer;">
                                        <i data-feather="edit-2" style="width: 16px;"></i>
                                    </button>
                                ` : '<span style="color:#d1d5db;">-</span>';

            return `
                                <tr>
                                    <td style="color: #6b7280; font-weight: 600;">${s.listNumber || '-'}</td>
                                    <td class="font-medium" style="cursor: pointer; color: #3b82f6;" onclick="App.showStudentProfile('${s.id}')">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="width: 24px; height: 24px; background: #eff6ff; color: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600;">${s.fullName.charAt(0)}</div>
                                            <span>${s.fullName}</span>
                                        </div>
                                    </td>
                                    <td><div style="font-size: 0.875rem;">${s.parentName}</div><div style="font-size: 0.75rem; color: #9ca3af;">${s.parentPhone}</div></td>
                                    <td><span class="badge badge-success">Active</span></td>
                                    <td>
                                        ${editBtn}
                                    </td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                     ${students.length === 0 ? '<div style="padding: 2rem; text-align: center; color: #9ca3af;">No students found in this class.</div>' : ''}
                </div>
            </div>
        `;
        const searchInput = document.getElementById('search-student');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                document.querySelectorAll('#student-table-body tr').forEach(row => {
                    row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none';
                });
            });
        }
        feather.replace();
    },

    renderClassFolders(container) {
        const grades = ["Form 1", "Form 2", "Form 3", "Form 4"];
        const students = Store.getStudents();

        container.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">Students Directory</h2>
                        <span style="background: #eef2ff; color: #6366f1; font-weight: 700; padding: 6px 16px; border-radius: 99px; font-size: 0.875rem; border: 1px solid #c7d2fe;">Total Students: ${students.length}</span>
                    </div>
                </div>
                
                <h3 style="font-size: 1.1rem; color: #6b7280; margin-bottom: 1.5rem;">Select Form</h3>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem;">
                    ${grades.map(grade => {
            const count = students.filter(s => s.grade === grade).length;
            return `
                        <div onclick="App.openClassFolder('${grade}')" class="glass-card" style="padding: 2rem; cursor: pointer; text-align: center;">
                            <div style="width: 54px; height: 54px; background: #eff6ff; color: #3b82f6; border-radius: 12px; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center;">
                                <i data-feather="users"></i>
                            </div>
                            <h3 style="font-weight: 700; color: #111827; margin-bottom: 0.5rem;">${grade}</h3>
                            <p style="color: #6b7280; font-size: 0.875rem;">${count} Students</p>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
        feather.replace();
    },

    // --- Attendance Logic ---

    openAttendanceFolder(grade) {
        this.state.currentAttendanceGrade = grade;
        this.state.currentAttendanceSection = null;
        this.state.currentAttendanceMonth = null;
        this.refreshCurrentView();
    },

    openAttendanceSection(section) {
        this.state.currentAttendanceSection = section;
        this.state.currentAttendanceMonth = null;
        this.refreshCurrentView();
    },

    openAttendanceMonth(monthStr) {
        this.state.currentAttendanceMonth = monthStr;
        this.refreshCurrentView();
    },

    closeAttendanceFolder() {
        if (this.state.currentAttendanceMonth) {
            this.state.currentAttendanceMonth = null;
        } else if (this.state.currentAttendanceSection) {
            this.state.currentAttendanceSection = null;
        } else {
            this.state.currentAttendanceGrade = null;
        }
        this.refreshCurrentView();
    },

    renderAttendance(container) {
        if (!this.state.currentAttendanceGrade) {
            this.renderAttendanceFolders(container);
        } else if (!this.state.currentAttendanceSection) {
            this.renderAttendanceSections(container);
        } else if (!this.state.currentAttendanceMonth) {
            this.renderAttendanceMonths(container);
        } else {
            this.renderAttendanceGrid(container);
        }
    },

    renderAttendanceSections(container) {
        const grade = this.state.currentAttendanceGrade;
        const sections = ["Section A", "Section B"];
        const settings = Store.getSettings();
        const headTeacher = settings.headTeachers[grade] || 'Not Assigned';

        container.innerHTML = `
            <div style="animation: fadeIn 0.4s ease-out;">
                <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 2rem;">Attendance</h2>
                
                <div style="display: flex; gap: 1rem; align-items: flex-start; margin-bottom: 2rem;">
                    <button onclick="App.closeAttendanceFolder()" class="btn glass-card" style="padding: 0.75rem; border-radius: 12px; height: 48px; width: 48px; display: flex; align-items: center; justify-content: center;">
                        <i data-feather="arrow-left" style="width: 20px; height: 20px;"></i>
                    </button>
                    <div>
                        <h3 style="font-size: 1.75rem; font-weight: 700; color: #111827;">${grade} Sections</h3>
                        <p style="color: #6b7280; font-size: 0.9rem;">Head Teacher: <strong>${headTeacher}</strong></p>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; max-width: 900px;">
                    ${sections.map(sec => `
                        <div onclick="App.openAttendanceSection('${sec.split(' ')[1]}')" class="glass-card" style="padding: 4rem 2rem; cursor: pointer; text-align: center; transition: all 0.2s ease;">
                            <div style="width: 64px; height: 64px; background: #eef2ff; color: #6366f1; border-radius: 16px; margin: 0 auto 2rem; display: flex; align-items: center; justify-content: center;">
                                <i data-feather="users" style="width: 28px; height: 28px;"></i>
                            </div>
                            <h4 style="font-weight: 700; color: #111827; margin-bottom: 0.75rem; font-size: 1.5rem;">${sec}</h4>
                            <p style="color: #6b7280; font-size: 0.95rem; max-width: 220px; margin: 0 auto; line-height: 1.5;">Manage attendance for this section only.</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        feather.replace();
    },

    renderAttendanceMonths(container) {
        const grade = this.state.currentAttendanceGrade;
        const section = this.state.currentAttendanceSection;
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        container.innerHTML = `
            <div>
                <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 2rem;">
                    <button onclick="App.closeAttendanceFolder()" class="btn glass-card" style="padding: 0.5rem;"><i data-feather="arrow-left"></i></button>
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">${grade} - Section ${section}</h2>
                        <p style="color: #6b7280; font-size: 0.85rem;">Select a month to record or update attendance for 2026.</p>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem;">
                    ${months.map((m, i) => {
            const monthNum = (i + 1).toString().padStart(2, '0');
            return `
                        <div onclick="App.openAttendanceMonth('2026-${monthNum}')" class="glass-card" style="padding: 1.5rem; cursor: pointer; text-align: center; border: 1px solid rgba(0,0,0,0.05);">
                            <h4 style="font-weight: 600; color: #111827;">${m}</h4>
                            <span style="font-size: 0.75rem; color: #9ca3af;">2026</span>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
        feather.replace();
    },


    renderAttendanceGrid(container) {
        const grade = this.state.currentAttendanceGrade;
        const section = this.state.currentAttendanceSection;
        const monthStr = this.state.currentAttendanceMonth; // "2026-01"
        const [year, month] = monthStr.split('-').map(Number);

        const monthName = new Date(year, month - 1).toLocaleString('en-us', { month: 'long' });
        const daysInMonth = new Date(year, month, 0).getDate();

        const students = Store.getStudents().filter(s => s.grade === grade && s.section === section);
        const attendance = Store.getAttendance();

        container.innerHTML = `
            <div class="glass-card" style="padding: 1.5rem; min-height: 500px; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <button onclick="App.closeAttendanceFolder()" class="btn" style="background: #f3f4f6; color: #374151; padding: 8px;"><i data-feather="arrow-left" style="width:18px;"></i></button>
                        <div>
                            <h3 style="font-weight: 700; color: #111827;">${monthName} ${year}</h3>
                            <p style="color: #6b7280; font-size: 0.75rem;">${grade} • Section ${section} • ${students.length} Students</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 4px; font-size: 0.7rem; color: #6b7280; margin-right: 1rem;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span> Present
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; margin-left: 8px;"></span> Absent
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; margin-left: 8px;"></span> Late
                        </div>
                    </div>
                </div>

                <div style="flex: 1; overflow-x: auto; border: 1px solid #f3f4f6; border-radius: 12px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                        <thead style="position: sticky; top: 0; background: #f9fafb; z-index: 10;">
                            <tr>
                                <th style="text-align: left; padding: 12px; min-width: 180px; border-bottom: 1px solid #e5e7eb; background: #f9fafb;">Student Name</th>
                                ${Array.from({ length: daysInMonth }, (_, i) => `<th style="text-align: center; min-width: 32px; border-bottom: 1px solid #e5e7eb;">${i + 1}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map(s => `
                                <tr>
                                    <td style="padding: 8px 12px; border-bottom: 1px solid #f9fafb; font-weight: 600; color: #374151; position: sticky; left: 0; background: white; border-right: 1px solid #f3f4f6;">${s.fullName}</td>
                                    ${Array.from({ length: daysInMonth }, (_, i) => {
            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${(i + 1).toString().padStart(2, '0')}`;
            const record = attendance.find(a => a.studentId === s.id && a.date === dateStr);
            let bgColor = '#f9fafb';
            let label = '';
            if (record) {
                if (record.status === 'Present') { bgColor = '#10b981'; label = 'P'; }
                if (record.status === 'Absent') { bgColor = '#ef4444'; label = 'A'; }
                if (record.status === 'Late') { bgColor = '#f59e0b'; label = 'L'; }
            }
            return `
                                            <td onclick="App.toggleAttendanceInline('${s.id}', '${dateStr}')" style="text-align: center; border-bottom: 1px solid #f9fafb; cursor: pointer; padding: 4px;">
                                                <div style="width: 24px; height: 24px; border-radius: 6px; background: ${bgColor}; margin: 0 auto; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.65rem;">
                                                    ${label}
                                                </div>
                                            </td>
                                        `;
        }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        feather.replace();
    },

    toggleAttendanceInline(studentId, date) {
        const attendance = Store.getAttendance();
        const record = attendance.find(a => a.studentId === studentId && a.date === date);

        let nextStatus = 'Present';
        if (record) {
            if (record.status === 'Present') nextStatus = 'Absent';
            else if (record.status === 'Absent') nextStatus = 'Late';
            else if (record.status === 'Late') nextStatus = 'Present';
        }

        Store.recordAttendance(studentId, nextStatus, date);
        this.renderAttendanceGrid(document.getElementById('main-content-area'));
    },

    quickMark(studentId, status) {
        const today = new Date().toISOString().split('T')[0];
        Store.recordAttendance(studentId, status, today);
        this.showToast(`Marked ${status}`);
        this.renderAttendance(document.getElementById('main-content-area'));
    },

    exportAttendance(grade) {
        alert(`Exporting Attendance Report for ${grade} to PDF... (Simulation Ready)`);
        Store.logAction('Export', `Exported attendance report for ${grade}`, JSON.parse(sessionStorage.getItem('dugsiga_user')).username);
    },

    renderAttendanceFolders(container) {
        const grades = ["Form 1", "Form 2", "Form 3", "Form 4"];
        const students = Store.getStudents();

        container.innerHTML = `
            <div>
                <h2 style="font-size: 1.5rem; font-weight: 700; color: #1f2937; margin-bottom: 2rem;">Attendance Registers</h2>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem;">
                    ${grades.map(grade => {
            const count = students.filter(s => s.grade === grade).length;
            return `
                        <div onclick="App.openAttendanceFolder('${grade}')" style="
                            background: white; 
                            border-radius: 12px; 
                            padding: 2rem; 
                            box-shadow: 0 1px 3px rgba(0,0,0,0.05); 
                            cursor: pointer; 
                            transition: transform 0.2s, box-shadow 0.2s;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            text-align: center;
                            border: 1px solid #f3f4f6;
                        " 
                        onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 10px 15px -3px rgba(0, 0, 0, 0.1)';"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)';"
                        >
                            <div style="
                                width: 64px; 
                                height: 64px; 
                                background: #ecfdf5; 
                                color: #10b981; 
                                border-radius: 16px; 
                                display: flex; 
                                align-items: center; 
                                justify-content: center; 
                                margin-bottom: 1rem;
                            ">
                                <i data-feather="calendar" style="width: 32px; height: 32px;"></i>
                            </div>
                            <h3 style="font-weight: 600; font-size: 1.1rem; color: #1f2937; margin-bottom: 0.25rem;">${grade}</h3>
                            <p style="color: #6b7280; font-size: 0.875rem;">${count} Students</p>
                        </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
        feather.replace();
    },

    renderBatchAttendance(container) {
        const grade = this.state.currentAttendanceGrade;
        // Filter students by the active grade
        const students = Store.getStudents().filter(s => s.grade === grade);
        const attendance = Store.getAttendance();
        const today = new Date().toISOString().split('T')[0];

        container.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                     <h3 style="font-size: 1.1rem; font-weight: 600;">Take Attendance: ${grade} (${today})</h3>
                     <button class="btn" onclick="App.renderAttendance(document.getElementById('main-content-area'))">Cancel</button>
                </div>
                 <table class="table">
                    <thead><tr><th>Student</th><th>Status (Select for Today)</th></tr></thead>
                    <tbody>
                        ${students.map(s => {
            const existing = attendance.find(a => a.studentId === s.id && a.date === today);
            const status = existing ? existing.status : 'Present';
            return `
                            <tr>
                                <td class="font-medium">${s.fullName}</td>
                                <td>
                                    <div style="display: flex; gap: 1.5rem;">
                                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;"><input type="radio" name="att-${s.id}" value="Present" ${status === 'Present' ? 'checked' : ''} style="accent-color: #10b981;"> <span style="color: #10b981; font-weight: 500;">Present</span></label>
                                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;"><input type="radio" name="att-${s.id}" value="Absent" ${status === 'Absent' ? 'checked' : ''} style="accent-color: #ef4444;"> <span style="color: #ef4444; font-weight: 500;">Absent</span></label>
                                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;"><input type="radio" name="att-${s.id}" value="Late" ${status === 'Late' ? 'checked' : ''} style="accent-color: #f59e0b;"> <span style="color: #f59e0b; font-weight: 500;">Late</span></label>
                                    </div>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
                <div style="margin-top: 1.5rem; text-align: right;">
                    <button id="save-batch-attendance" class="btn btn-primary" style="background: #111827;">Save Records</button>
                </div>
            </div>
        `;
        document.getElementById('save-batch-attendance').addEventListener('click', () => {
            students.forEach(s => {
                const el = document.querySelector(`input[name="att-${s.id}"]:checked`);
                if (el) Store.recordAttendance(s.id, el.value, today);
            });
            this.showToast('Batch attendance saved!');
            // Helper to just return to the current folder view
            this.renderAttendance(container);
        });
    },

    renderReports(container) {
        const fees = Store.getFees();
        const unpaidFees = fees.filter(f => f.status === 'UNPAID');
        const paidFees = fees.filter(f => f.status === 'PAID');
        container.innerHTML = `
            <div>
                 <h3 style="font-size: 1.25rem; font-weight: 700; color: #1f2937; margin-bottom: 1.5rem;">Reports & Analytics</h3>
                 <div class="responsive-grid-2" style="margin-bottom: 2rem;">
                    <div style="background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <h4 style="font-weight: 600; margin-bottom: 1rem;">Fee Collection Status</h4>
                        <div style="height: 250px; display: flex; justify-content: center;"><canvas id="feePieChart"></canvas></div>
                    </div>
                    <div style="background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <h4 style="font-weight: 600; margin-bottom: 1rem;">Attendance Distribution (Last 7 Days)</h4>
                         <div style="height: 250px;"><canvas id="attBarChart"></canvas></div>
                    </div>
                 </div>
                 <div style="background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="margin-bottom: 1rem;"><h4 style="font-weight: 600; font-size: 1.1rem;">Defaulters List</h4><p style="color: #6b7280; font-size: 0.875rem;">Students with outstanding balances.</p></div>
                    <table class="table">
                        <thead><tr><th>STUDENT</th><th style="text-align: right;">AMOUNT DUE</th><th style="text-align: right;">STATUS</th></tr></thead>
                        <tbody>
                            ${unpaidFees.slice(0, 5).map(f => `<tr><td style="font-weight: 500;">${Store.getStudent(f.studentId)?.fullName || 'Unknown'}</td><td style="text-align: right; color: #374151;">$${f.amount}</td><td style="text-align: right; color: #ef4444; font-weight: 500;">Unpaid</td></tr>`).join('')}
                        </tbody>
                    </table>
                 </div>
            </div>
        `;
        this.initReportsCharts(paidFees.length, unpaidFees.length);
    },

    initReportsCharts(paidCount, unpaidCount) {
        new Chart(document.getElementById('feePieChart'), { type: 'pie', data: { labels: ['Paid', 'Unpaid'], datasets: [{ data: [paidCount || 1, unpaidCount || 1], backgroundColor: ['#10b981', '#ef4444'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } } });
        new Chart(document.getElementById('attBarChart'), { type: 'bar', data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], datasets: [{ label: 'Present', data: [45, 48, 40, 47, 42], backgroundColor: '#10b981' }, { label: 'Absent', data: [5, 2, 10, 3, 8], backgroundColor: '#ef4444' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { staked: true, grid: { display: false } }, y: { stacked: true, grid: { borderDash: [4, 4] } } }, plugins: { legend: { position: 'top' } } } });
    },

    // --- Fee Management Logic ---
    openFeeDorm(dorm) {
        this.state.currentFeeDorm = dorm;
        this.state.currentFeeGrade = null;
        this.state.currentFeeSection = null;
        this.state.showFreeStudents = false;
        this.refreshCurrentView();
    },

    openFeeGrade(grade) {
        this.state.currentFeeGrade = grade;
        this.state.currentFeeSection = null;
        this.state.currentFeeMonth = null;
        this.refreshCurrentView();
    },

    openFeeSection(section) {
        this.state.currentFeeSection = section;
        this.state.currentFeeMonth = null;
        this.refreshCurrentView();
    },

    openFeeMonth(month) {
        this.state.currentFeeMonth = month;
        this.refreshCurrentView();
    },

    openFreeStudents() {
        this.state.showFreeStudents = true;
        this.state.currentFeeGrade = null;
        this.state.currentFeeSection = null;
        this.state.currentFeeMonth = null;
        this.refreshCurrentView();
    },

    closeFeeView() {
        if (this.state.currentFeeMonth) {
            this.state.currentFeeMonth = null;
        } else if (this.state.currentFeeSection) {
            this.state.currentFeeSection = null;
        } else if (this.state.currentFeeGrade) {
            this.state.currentFeeGrade = null;
        } else {
            this.state.showFreeStudents = false;
        }
        this.refreshCurrentView();
    },

    renderFees(container) {
        if (this.state.showFreeStudents) {
            this.renderFreeStudents(container);
        } else if (!this.state.currentFeeGrade) {
            this.renderFeeFolders(container);
        } else if (!this.state.currentFeeSection) {
            this.renderFeeSections(container);
        } else if (!this.state.currentFeeMonth) {
            this.renderFeeMonths(container);
        } else {
            this.renderFeeStudentList(container);
        }
    },

    renderFeeFolders(container) {
        const grades = ["Form 1", "Form 2", "Form 3", "Form 4"];
        const students = Store.getStudents();

        container.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">Fee Management</h2>
                    <button onclick="App.openFreeStudents()" class="btn glass-card" style="padding: 10px 20px; color: #6366f1; font-weight: 700; border: 1px solid #6366f1;">
                        <i data-feather="heart" style="width:16px; margin-right:6px;"></i> Exempt Students
                    </button>
                </div>
                
                <h3 style="font-size: 1.1rem; color: #6b7280; margin-bottom: 1.5rem;">Select Form</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem;">
                    ${grades.map(grade => {
            const count = students.filter(s => s.grade === grade && !s.isFree).length;
            return `
                        <div onclick="App.openFeeGrade('${grade}')" class="glass-card" style="padding: 2rem; cursor: pointer; text-align: center; transition: transform 0.2s;">
                            <div style="width: 54px; height: 54px; background: #fff1f2; color: #e11d48; border-radius: 12px; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center;">
                                <i data-feather="folder"></i>
                            </div>
                            <h3 style="font-weight: 700; color: #111827; margin-bottom: 0.5rem;">${grade}</h3>
                            <p style="color: #6b7280; font-size: 0.875rem;">${count} Payers</p>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
        feather.replace();
    },



    renderFeeSections(container) {
        const grade = this.state.currentFeeGrade;
        const sections = ["A", "B"];
        const students = Store.getStudents();

        container.innerHTML = `
            <div>
                <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 2rem;">
                    <button onclick="App.closeFeeView()" class="btn glass-card" style="padding: 0.5rem;"><i data-feather="arrow-left"></i></button>
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">${grade} Sections</h2>
                        <p style="color: #6b7280; font-size: 0.85rem;">Select a section to manage fees.</p>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
                    ${sections.map(sec => {
            const count = students.filter(s => s.grade === grade && s.section === sec && !s.isFree).length;
            return `
                        <div onclick="App.openFeeSection('${sec}')" class="glass-card" style="padding: 1.5rem; cursor: pointer; text-align: center;">
                            <h4 style="font-weight: 700; color: #111827; margin-bottom: 4px;">Section ${sec}</h4>
                            <p style="color: #6b7280; font-size: 0.75rem;">${count} Payers</p>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
        feather.replace();
    },

    renderFreeStudents(container) {
        const students = Store.getStudents().filter(s => s.isFree);

        container.innerHTML = `
            <div style="animation: fadeIn 0.4s ease-out;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">Free Fee Students</h2>
                        <p style="color: #6b7280; font-size: 0.875rem;">List of students exempted from paying school fees (40 total).</p>
                    </div>
                    <div style="background: #fef3c7; color: #d97706; font-weight: 700; padding: 6px 16px; border-radius: 99px; font-size: 0.875rem; border: 1px solid #fde68a;">
                        ${students.length} Exempted
                    </div>
                </div>

                <div class="glass-card" style="padding: 1.5rem;">
                    <div style="overflow-x: auto;">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Student Name</th>
                                    <th>Form</th>
                                    <th>Section</th>
                                    <th>Parent Name</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${students.sort((a, b) => (a.grade > b.grade) ? 1 : -1).map((s, idx) => `
                                    <tr>
                                        <td style="color: #6b7280;">${idx + 1}</td>
                                        <td style="font-weight: 600; color: #1f2937;">${s.fullName}</td>
                                        <td><span class="badge badge-neutral">${s.grade}</span></td>
                                        <td>Section ${s.section}</td>
                                        <td style="color: #6b7280;">${s.parentName}</td>
                                        <td><span class="badge badge-success">Fee Exempt</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        feather.replace();
    },

    renderFreeStudents(container) {
        const students = Store.getStudents().filter(s => s.isFree);
        const grades = ["Form 1", "Form 2", "Form 3", "Form 4"];

        container.innerHTML = `
            <div>
                <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 2rem;">
                    <button onclick="App.closeFeeView()" class="btn glass-card" style="padding: 0.5rem;"><i data-feather="arrow-left"></i></button>
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">Free Fee Students</h2>
                        <p style="color: #6b7280; font-size: 0.85rem;">Official list of students exempted from monthly tuition fees.</p>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 2rem;">
                    ${grades.map(grade => {
            const gradeStudents = students.filter(s => s.grade === grade);
            if (gradeStudents.length === 0) return '';
            return `
                        <div class="glass-card" style="padding: 1.5rem;">
                            <h3 style="font-weight: 700; color: #111827; margin-bottom: 1.5rem; border-bottom: 2px solid #6366f1; width: max-content; padding-right: 2rem;">${grade}</h3>
                            <div style="overflow-x: auto;">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Student Name</th>
                                            <th>Section</th>
                                            <th>Dorm</th>
                                            <th>Parent Phone</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${gradeStudents.map(s => `
                                            <tr>
                                                <td style="color: #6b7280; font-weight: 700;">${s.listNumber}</td>
                                                <td style="font-weight: 600; color: #1f2937;">${s.fullName}</td>
                                                <td>Section ${s.section}</td>
                                                <td>${s.dorm}</td>
                                                <td style="font-size: 0.85rem; color: #6b7280;">${s.parentPhone}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
        }).join('')}
                </div>
            </div>
        `;
        feather.replace();
    },

    renderFeeMonths(container) {
        const grade = this.state.currentFeeGrade;
        const section = this.state.currentFeeSection;
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        container.innerHTML = `
            <div>
                <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 2rem;">
                    <button onclick="App.closeFeeView()" class="btn glass-card" style="padding: 0.5rem;"><i data-feather="arrow-left"></i></button>
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">${grade} - Section ${section}</h2>
                        <p style="color: #6b7280; font-size: 0.85rem;">Select a month to view fee status.</p>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem;">
                    ${months.map(m => `
                        <div onclick="App.openFeeMonth('${m}')" class="glass-card" style="padding: 1.5rem; cursor: pointer; text-align: center;">
                            <h4 style="font-weight: 600; color: #111827;">${m}</h4>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        feather.replace();
    },

    renderFeeStudentList(container) {
        const grade = this.state.currentFeeGrade;
        const section = this.state.currentFeeSection;
        const month = this.state.currentFeeMonth;

        const students = Store.getStudents()
            .filter(s => s.grade === grade && s.section === section && !s.isFree)
            .sort((a, b) => a.listNumber - b.listNumber);
        const fees = Store.getFees();

        container.innerHTML = `
            <div class="glass-card" style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <button onclick="App.closeFeeView()" class="btn glass-card" style="padding: 8px;"><i data-feather="arrow-left" style="width:18px;"></i></button>
                        <div>
                            <h3 style="font-weight: 700; color: #111827;">Fee Status: ${grade} - Sec ${section}</h3>
                            <p style="color: #6b7280; font-size: 0.75rem;">Showing status for ${month}</p>
                        </div>
                    </div>
                </div>

                <div style="overflow-x: auto;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th style="width: 50px;">#</th>
                                <th>Student Name</th>
                                <th>Amount</th>
                                <th style="text-align: center;">Status</th>
                                <th style="text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map(s => {
            const fee = fees.find(f => f.studentId === s.id && f.month === month);
            const status = fee ? fee.status : 'UNPAID';
            return `
                                <tr>
                                    <td style="color: #6b7280; font-weight: 600;">${s.listNumber}</td>
                                    <td>
                                        <div style="font-weight: 600; color: #1f2937;">${s.fullName}</div>
                                        <div style="font-size: 0.7rem; color: #9ca3af;">ID: ${s.id}</div>
                                    </td>
                                    <td style="color: #4b5563; font-weight: 500;">$${fee ? fee.amount : 20}</td>
                                    <td style="text-align: center;">
                                        <span style="background: ${status === 'PAID' ? '#ecfdf5' : '#fef2f2'}; color: ${status === 'PAID' ? '#059669' : '#dc2626'}; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; border: 1px solid currentColor;">
                                            ${status}
                                        </span>
                                    </td>
                                    <td style="text-align: right;">
                                        ${fee ? `
                                            <button onclick="App.execToggleFee('${fee.id}')" class="btn" style="background: none; border: none; font-weight: 700; color: #6366f1; cursor: pointer; padding: 0;">Update Payment</button>
                                        ` : `
                                            <span style="color: #9ca3af; font-size: 0.75rem;">No record</span>
                                        `}
                                    </td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        feather.replace();
    },

    execToggleFee(feeId) {
        Store.toggleFeeStatus(feeId);
        this.showToast('Fee status updated');
        this.refreshCurrentView();
    },

    // Data Management: Export and Import JSON data
    renderDataManagement(container) {
        const auditLogs = Store.getAuditLogs();
        const settings = Store.getSettings();

        container.innerHTML = `
            <div style="animation: fadeIn 0.5s ease-out;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                    <div class="glass-card" style="padding: 1.5rem;">
                        <h3 style="font-weight: 700; color: #111827; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px;">
                            <i data-feather="settings" style="width:20px; color:#6366f1;"></i> School Leadership
                        </h3>
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div>
                                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #6b7280; margin-bottom: 4px; text-transform: uppercase;">Principal Name</label>
                                <input type="text" id="setting-principal" class="form-input" value="${settings.principalName}" style="background: rgba(255,255,255,0.5);">
                            </div>
                            <div style="margin-top: 0.5rem;">
                                <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #6b7280; margin-bottom: 8px; text-transform: uppercase;">Form Head Teachers</label>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                    ${Object.entries(settings.headTeachers).map(([form, name]) => `
                                        <div>
                                            <span style="font-size: 0.7rem; color: #9ca3af; display: block; margin-bottom: 2px;">${form}</span>
                                            <input type="text" id="head-teacher-${form.replace(' ', '')}" class="form-input" value="${name}" style="background: rgba(255,255,255,0.5); font-size: 0.8rem;">
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            <button onclick="App.saveLeadershipSettings()" class="btn btn-primary" style="margin-top: 1rem; width: 100%;">Save Leadership Changes</button>
                        </div>
                    </div>

                    <div class="glass-card" style="padding: 1.5rem;">
                        <h3 style="font-weight: 700; color: #111827; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px;">
                            <i data-feather="download-cloud" style="width:20px; color:#6366f1;"></i> Data Operations
                        </h3>
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <p style="font-size: 0.85rem; color: #6b7280;">Securely export your school records or restore from a backup file.</p>
                            <div style="display: flex; gap: 12px; margin-top: 1rem;">
                                <button id="export-btn" class="btn glass-card" style="flex: 1; border: 1px solid #6366f1; color: #6366f1;">
                                    <i data-feather="download" style="width:16px; margin-right:6px;"></i> Export Data
                                </button>
                                <button id="import-btn" class="btn glass-card" style="flex: 1; border: 1px solid #10b981; color: #10b981;">
                                    <i data-feather="upload" style="width:16px; margin-right:6px;"></i> Import Backup
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="glass-card" style="padding: 1.5rem;">
                    <h3 style="font-weight: 700; color: #111827; margin-bottom: 1.5rem; display:flex; align-items:center; gap:8px;">
                        <i data-feather="shield" style="width:18px; color:#6366f1;"></i> System Audit Log
                    </h3>
                    <div style="overflow-x: auto;">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th style="font-size:0.75rem; color:#6b7280;">TIMESTAMP</th>
                                    <th style="font-size:0.75rem; color:#6b7280;">USER</th>
                                    <th style="font-size:0.75rem; color:#6b7280;">ACTION</th>
                                    <th style="font-size:0.75rem; color:#6b7280;">DETAILS</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${auditLogs.map(log => `
                                    <tr>
                                        <td style="font-size:0.8rem; color:#6b7280; white-space:nowrap;">${new Date(log.timestamp).toLocaleString()}</td>
                                        <td><span style="font-weight:600; color:#1f2937;">${log.user}</span></td>
                                        <td><span style="background:#eef2ff; color:#6366f1; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;">${log.action}</span></td>
                                        <td style="font-size:0.85rem; color:#4b5563;">${log.details}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <input type="file" id="import-file" accept=".json" style="display:none;" />
            </div>
        `;

        // Export handler
        document.getElementById('export-btn').addEventListener('click', () => {
            const dataStr = Store.exportData();
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dugsiga_data_export.json';
            a.click();
            URL.revokeObjectURL(url);
        });

        // Import handler
        document.getElementById('import-btn').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        document.getElementById('import-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    Store.importData(evt.target.result);
                    this.showToast('Data imported successfully!');
                    this.refreshCurrentView();
                } catch (err) {
                    console.error(err);
                    this.showToast('Import failed. Check console for details.');
                }
            };
            reader.readAsText(file);
        });
    },

    renderParentMessages(container) {
        if (!this.state.currentMessagingGrade) {
            this.renderMessagingFolders(container);
        } else if (!this.state.currentMessagingSection) {
            this.renderMessagingSections(container);
        } else {
            this.renderParentMessageList(container);
        }
    },

    openMessagingGrade(grade) {
        this.state.currentMessagingGrade = grade;
        this.state.currentMessagingSection = null;
        this.refreshCurrentView();
    },

    openMessagingSection(section) {
        this.state.currentMessagingSection = section;
        this.refreshCurrentView();
    },

    closeMessagingView() {
        if (this.state.currentMessagingSection) {
            this.state.currentMessagingSection = null;
        } else {
            this.state.currentMessagingGrade = null;
        }
        this.refreshCurrentView();
    },

    renderMessagingFolders(container) {
        const grades = ["Form 1", "Form 2", "Form 3", "Form 4"];
        const students = Store.getStudents();

        container.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">Private Parent Messages</h2>
                </div>
                
                <h3 style="font-size: 1.1rem; color: #6b7280; margin-bottom: 1.5rem;">Select Form</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem;">
                    ${grades.map(grade => {
            const count = students.filter(s => s.grade === grade).length;
            return `
                        <div onclick="App.openMessagingGrade('${grade}')" class="glass-card" style="padding: 2rem; cursor: pointer; text-align: center;">
                            <div style="width: 54px; height: 54px; background: #fef3c7; color: #d97706; border-radius: 12px; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center;">
                                <i data-feather="message-square"></i>
                            </div>
                            <h3 style="font-weight: 700; color: #111827; margin-bottom: 0.5rem;">${grade}</h3>
                            <p style="color: #6b7280; font-size: 0.875rem;">${count} Parents</p>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
        feather.replace();
    },

    renderClassFolders(container) {
        const grades = ["Form 1", "Form 2", "Form 3", "Form 4"];
        const students = Store.getStudents();

        container.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">Students Directory</h2>
                        <span style="background: #eef2ff; color: #6366f1; font-weight: 700; padding: 6px 16px; border-radius: 99px; font-size: 0.875rem; border: 1px solid #c7d2fe;">Total Students: ${students.length}</span>
                    </div>
                </div>
                
                <h3 style="font-size: 1.1rem; color: #6b7280; margin-bottom: 1.5rem;">Select Form</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem;">
                    ${grades.map(grade => {
            const count = students.filter(s => s.grade === grade).length;
            return `
                        <div onclick="App.openMessagingGrade('${grade}')" class="glass-card" style="padding: 2rem; cursor: pointer; text-align: center;">
                            <div style="width: 54px; height: 54px; background: #fef3c7; color: #d97706; border-radius: 12px; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center;">
                                <i data-feather="message-square"></i>
                            </div>
                            <h3 style="font-weight: 700; color: #111827; margin-bottom: 0.5rem;">${grade}</h3>
                            <p style="color: #6b7280; font-size: 0.875rem;">${count} Parents</p>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
        feather.replace();
    },

    renderMessagingSections(container) {
        const grade = this.state.currentMessagingGrade;
        const sections = ["A", "B"];
        const students = Store.getStudents();

        container.innerHTML = `
            <div>
                <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 2rem;">
                    <button onclick="App.closeMessagingView()" class="btn glass-card" style="padding: 0.5rem;"><i data-feather="arrow-left"></i></button>
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">${grade} Sections</h2>
                        <p style="color: #6b7280; font-size: 0.85rem;">Select a section to manage parent messages.</p>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
                    ${sections.map(sec => {
            const count = students.filter(s => s.grade === grade && s.section === sec).length;
            return `
                        <div onclick="App.openMessagingSection('${sec}')" class="glass-card" style="padding: 1.5rem; cursor: pointer; text-align: center;">
                            <h4 style="font-weight: 700; color: #111827; margin-bottom: 4px;">Section ${sec}</h4>
                            <p style="color: #6b7280; font-size: 0.75rem;">${count} Parents</p>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
        feather.replace();
    },

    renderParentMessageList(container) {
        const grade = this.state.currentMessagingGrade;
        const section = this.state.currentMessagingSection;
        const students = Store.getStudents().filter(s => s.grade === grade && s.section === section);

        container.innerHTML = `
            <div class="glass-card" style="padding: 1.5rem;">
                <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 2rem;">
                    <button onclick="App.closeMessagingView()" class="btn glass-card" style="padding: 8px;"><i data-feather="arrow-left" style="width:18px;"></i></button>
                    <div>
                        <h3 style="font-weight: 700; color: #111827;">${grade} - Sec ${section} Parents</h3>
                        <p style="color: #6b7280; font-size: 0.75rem;">Compose and send messages to individual parents.</p>
                    </div>
                </div>

                <div style="overflow-x: auto;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th style="width: 50px;">#</th>
                                <th>Parent Name</th>
                                <th>Student Name</th>
                                <th>Message</th>
                                <th style="text-align: right;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map(s => `
                                <tr>
                                    <td style="color: #6b7280;">${s.listNumber}</td>
                                    <td>
                                        <div style="font-weight: 600; color: #1f2937;">${s.parentName}</div>
                                        <div style="font-size: 0.7rem; color: #9ca3af;">${s.parentPhone}</div>
                                    </td>
                                    <td style="color: #4b5563;">${s.fullName}</td>
                                    <td>
                                        <input type="text" id="msg-${s.id}" class="form-input" placeholder="Type message..." style="font-size: 0.85rem;">
                                    </td>
                                    <td style="text-align: right;">
                                        <button onclick="App.sendIndividualMessage('${s.id}')" class="btn" style="background: #6366f1; color: white; padding: 6px 12px; font-size: 0.8rem; display: flex; align-items: center; gap: 4px; margin-left: auto;">
                                            <i data-feather="send" style="width:14px;"></i> Send
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        feather.replace();
    },

    sendIndividualMessage(studentId) {
        const input = document.getElementById(`msg-${studentId}`);
        const message = input.value.trim();
        if (!message) {
            this.showToast('Please type a message first');
            return;
        }

        const student = Store.getStudents().find(s => s.id === studentId);
        // Log to audit trail
        Store.logAction('Messaging', `Individual SMS sent to ${student.parentName} (${student.parentPhone}) regarding ${student.fullName}: "${message}"`, JSON.parse(sessionStorage.getItem('dugsiga_user'))?.username || 'System');

        input.value = '';
        this.showToast(`Message sent to ${student.parentName}`);
    },

    // --- Messaging View (Broadcast) ---
    renderMessaging(container) {
        const settings = Store.getSettings();
        const students = Store.getStudents();

        if (!this.state.messagingTab) this.state.messagingTab = 'reminder';

        container.innerHTML = `
            <div style="animation: fadeIn 0.4s ease-out;">
                <div class="glass-card" style="padding: 1.5rem; margin-bottom: 2rem;">
                    <div style="display: flex; gap: 2rem; border-bottom: 1px solid #e5e7eb; margin-bottom: 1.5rem;">
                        <button onclick="App.setMessagingTab('reminder')" style="padding: 0.75rem 0; border-bottom: 2px solid ${this.state.messagingTab === 'reminder' ? '#6366f1' : 'transparent'}; font-weight: 600; color: ${this.state.messagingTab === 'reminder' ? '#6366f1' : '#6b7280'}; cursor: pointer; background:none; border:none;">Fee Reminder</button>
                        <button onclick="App.setMessagingTab('deadline')" style="padding: 0.75rem 0; border-bottom: 2px solid ${this.state.messagingTab === 'deadline' ? '#6366f1' : 'transparent'}; font-weight: 600; color: ${this.state.messagingTab === 'deadline' ? '#6366f1' : '#6b7280'}; cursor: pointer; background:none; border:none;">Deadline Notification</button>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; font-size: 0.8rem; font-weight: 600; color: #6b7280; margin-bottom: 0.5rem;">Sender Number (Editable)</label>
                        <input type="text" id="sms-sender" class="form-input" style="max-width: 300px;" value="${settings.messaging.senderNumber}">
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; font-size: 0.8rem; font-weight: 600; color: #6b7280; margin-bottom: 0.5rem;">Broadcast Message Content</label>
                        <textarea id="sms-content" class="form-input" style="height: 120px; font-family: inherit; line-height: 1.5;">${settings.messaging.templates[this.state.messagingTab]}</textarea>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
                         <p style="font-size: 0.8rem; color: #6b7280;">This message will be sent to ALL parents in the system.</p>
                         <button onclick="App.broadcastMessaging()" class="btn" style="background: #6366f1; color: white; display: flex; align-items: center; gap: 8px;">
                            <i data-feather="send" style="width: 16px;"></i> Broadcast to All
                         </button>
                    </div>
                </div>
            </div>
        `;
        feather.replace();
    },

    setMessagingTab(tab) {
        this.state.messagingTab = tab;
        this.refreshCurrentView();
    },

    broadcastMessaging() {
        const content = document.getElementById('sms-content').value;
        const sender = document.getElementById('sms-sender').value;
        const students = Store.getStudents();

        if (confirm(`Are you sure you want to send this message to all ${students.length} parents?`)) {
            students.forEach(s => {
                Store.sendMessage(s.parentPhone, content, sender);
            });
            this.showToast('Message broadcasted successfully!');
        }
    },

    singleSendSMS(phone, name) {
        const content = document.getElementById('sms-content').value;
        const sender = document.getElementById('sms-sender').value;
        Store.sendMessage(phone, content, sender);
        this.showToast(`Message sent to ${name}`);
    },

    saveLeadershipSettings() {
        const principalName = document.getElementById('setting-principal').value;
        const headTeachers = {
            "Form 1": document.getElementById('head-teacher-Form1').value,
            "Form 2": document.getElementById('head-teacher-Form2').value,
            "Form 3": document.getElementById('head-teacher-Form3').value,
            "Form 4": document.getElementById('head-teacher-Form4').value,
        };
        Store.updateSettings({ principalName, headTeachers });

        // Instant Update UI
        const principalDisplay = document.getElementById('principal-name-display');
        if (principalDisplay) principalDisplay.textContent = principalName;

        this.showToast('Leadership information updated!');
        this.refreshCurrentView();
    },
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
