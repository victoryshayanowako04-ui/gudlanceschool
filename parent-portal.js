// Set up a clean slate for the parent session
window.currentParentStudent = null;

// FOOLPROOF BACK BUTTON
window.returnToParentHub = function() {
    // 1. Force hide all specific sub-screens
    const screens = ['parentDashboard', 'parentAnnouncementsScreen', 'parentAttendanceScreen'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 2. Force show the main hub
    const hub = document.getElementById('parentHubDashboard');
    if (hub) {
        hub.style.display = 'flex';
    } else {
        console.error("Hub screen not found in HTML!");
    }
};

window.loginAsParent = function() {
    const studentIdInput = document.getElementById('parentStudentId').value.trim().toUpperCase();
    const phoneInput = document.getElementById('parentPhone').value.trim();

    if (!studentIdInput || !phoneInput) {
        alert("Please enter both the Student ID and Phone Number.");
        return;
    }

    let latestStudents = window.students;
    if (!latestStudents || latestStudents.length === 0) {
        const localData = JSON.parse(localStorage.getItem('haven_data')) || {};
        latestStudents = localData.students || [];
    }

    if (!latestStudents || latestStudents.length === 0) {
        alert("System is still loading data. Please wait 5 seconds and try again.");
        return;
    }

    const student = latestStudents.find(s => s.id && s.id.toUpperCase() === studentIdInput);

    if (!student) {
        alert("Student ID not found: " + studentIdInput + ". Please check the spelling.");
        return;
    }

    const studentPhone = (student.cell || "").trim();
    if (studentPhone !== phoneInput && !studentPhone.endsWith(phoneInput.slice(-4))) {
        alert("Phone number does not match the registered guardian for " + student.name + ".");
        return;
    }

    window.currentParentStudent = student;

    const welcomeMsg = document.getElementById('pdWelcomeMessage');
    if(welcomeMsg) welcomeMsg.innerText = "Welcome back, parent of " + student.name + "!";

    document.getElementById('pdStudentName').innerText = student.name;
    document.getElementById('pdStudentId').innerText = student.id;
    document.getElementById('pdGrade').innerText = student.grade || "N/A";
    
    let balance = parseFloat(student.balance || 0);
    document.getElementById('pdBalance').innerText = "$" + balance.toFixed(2);
    
    document.getElementById('parentLoginModal').style.display = 'none';
    document.getElementById('parentHubDashboard').style.display = 'flex';
};

window.showParentFinance = function() {
    if (typeof window.recordVisit === 'function') {
        const student = window.currentParentStudent || {};
        window.recordVisit(student.name || student.student_name || `Student ${student.id}`, 'Parent', 'Parent Page View', 'Fees & Payments');
    }
    document.getElementById('parentHubDashboard').style.display = 'none';
    document.getElementById('parentDashboard').style.display = 'block'; 
    
    if (window.currentParentStudent) {
        let balance = parseFloat(window.currentParentStudent.balance || 0);
        if (balance <= 0) {
            document.getElementById('paynowSection').style.display = 'none';
            document.getElementById('clearedSection').style.display = 'block';
        } else {
            document.getElementById('paynowSection').style.display = 'block';
            document.getElementById('clearedSection').style.display = 'none';
        }
    }
};

window.showParentAnnouncements = function() {
    if (typeof window.recordVisit === 'function') {
        const student = window.currentParentStudent || {};
        window.recordVisit(student.name || student.student_name || `Student ${student.id}`, 'Parent', 'Parent Page View', 'School Events & News');
    }
    document.getElementById('parentHubDashboard').style.display = 'none';
    document.getElementById('parentAnnouncementsScreen').style.display = 'block';
    
    const list = document.getElementById('parentAnnouncementList');
    const announcements = JSON.parse(localStorage.getItem('haven_announcements')) || [];
    
    if (announcements.length === 0) {
        list.innerHTML = "<p style='text-align:center; color:#7f8c8d;'>No active announcements at this time.</p>";
        return;
    }
    
    list.innerHTML = announcements.map(a => `
        <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #3498db; margin-bottom: 15px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: bold; color: #2c3e50; font-size: 16px;">${a.type}</span>
                <span style="font-size: 12px; color: #7f8c8d;">${a.date}</span>
            </div>
            <h3 style="margin: 0 0 8px 0; color: #2980b9;">${a.title}</h3>
            <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.5;">${a.desc}</p>
        </div>
    `).join('');
};

// --- COMPLETE NEW FUNCTION TO PASTE INTO parent-portal.js ---
window.showParentAttendance = async function() {
    if (typeof window.recordVisit === 'function') {
        const student = window.currentParentStudent || {};
        window.recordVisit(student.name || student.student_name || `Student ${student.id}`, 'Parent', 'Parent Page View', 'Attendance & Register');
    }
    document.getElementById('parentHubDashboard').style.display = 'none';
    
    let attScreen = document.getElementById('parentAttendanceScreen');
    if (!attScreen) {
        attScreen = document.createElement('div');
        attScreen.id = 'parentAttendanceScreen';
        attScreen.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #f4f7f6; z-index: 20000; overflow-y: auto; padding: 20px; box-sizing: border-box;';
        document.body.appendChild(attScreen);
    }
    
    const student = window.currentParentStudent || {};
    
    // --- 🛠️ THE CLOUD DATABASE FIX START ---
    let globalLogs = [];
    
    // 2. Fetch directly from your Supabase Database
    if (navigator.onLine && typeof supabaseClient !== 'undefined') {
        try {
            // Show a temporary loading text on the screen
            attScreen.innerHTML = `<h3 style="text-align:center; margin-top:50px;">☁️ Fetching live attendance from database...</h3>`;
            attScreen.style.display = 'block';

            // Load only recent attendance fields; the in-row student records are still filtered in JavaScript.
            const cutoffDate = new Date();
            cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
            const cutoff = cutoffDate.toISOString().slice(0, 10);
            const { data, error } = await supabaseClient
                .from('attendance')
                .select('date,records')
                .gte('date', cutoff)
                .order('date', { ascending: false });
            
            if (error) throw error;
            if (data) globalLogs = data;
            
        } catch (err) {
            console.error("Cloud fetch failed:", err);
            globalLogs = JSON.parse(localStorage.getItem('havenAttendance') || "[]");
        }
    } else {
        globalLogs = JSON.parse(localStorage.getItem('havenAttendance') || "[]");
    }

    const attendanceData = [];
    
    // 🕵️ INVESTIGATION LOG 1: Check the student ID
    console.log("1. Current Student being checked:", student.name, "| ID:", student.id);
    console.log("2. Total logs fetched from database:", globalLogs.length);

    // 3. Filter the cloud data for this specific student
    globalLogs.forEach(log => {
        if (log.records && Array.isArray(log.records)) {
            const studentRecord = log.records.find(r => String(r.id) === String(student.id));
            if (studentRecord) {
                // 🕵️ INVESTIGATION LOG 2: We found a match! What does it look like?
                console.log("3. Found a record for this student on", log.date, "->", studentRecord.status);
                
                attendanceData.push({
                    date: log.date,
                    status: studentRecord.status,
                    reason: studentRecord.reason || ''
                });
            }
        }
    });
    // --- 🛠️ THE CLOUD DATABASE FIX END ---
    
    let presentCount = 0, absentCount = 0, lateCount = 0;
    let historyHTML = '';
    
    const sortedAtt = [...attendanceData].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    sortedAtt.forEach(record => {
        // --- 🛠️ THE CASE-SENSITIVITY FIX ---
        let safeStatus = record.status ? String(record.status).toLowerCase().trim() : '';

        if (safeStatus === 'present') presentCount++;
        else if (safeStatus === 'absent') absentCount++;
        else if (safeStatus === 'late') lateCount++;
        
        let statusColor = safeStatus === 'present' ? '#27ae60' : (safeStatus === 'absent' ? '#e74c3c' : '#f39c12');
        let displayStatus = safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1);
        
        historyHTML += `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${record.date}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; color: ${statusColor}; font-weight: bold;">
                    ${displayStatus} ${record.reason ? `<br><small style="color:#7f8c8d; font-weight:normal;">(${record.reason})</small>` : ''}
                </td>
            </tr>
        `;
    });
    
    // 🕵️ INVESTIGATION LOG 3: Final Count
    console.log("4. Final Calculated Counts -> Present:", presentCount, "Absent:", absentCount, "Late:", lateCount);

    if (historyHTML === '') historyHTML = `<tr><td colspan="2" style="text-align: center; padding: 20px; color: #7f8c8d;">No attendance records found yet.</td></tr>`;

    // Render the final HTML to the screen
    attScreen.innerHTML = `
        <div style="max-width: 600px; margin: 20px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <button onclick="returnToParentHub()" style="background: none; border: none; color: #3498db; font-weight: bold; font-size: 15px; cursor: pointer; margin-bottom: 15px; display: inline-flex; align-items: center; gap: 5px;">⬅ Back to Hub</button>
            <h2 style="color: #2c3e50; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px; margin-top: 0;">📋 Attendance Register</h2>
            <h4 style="color: #34495e; margin-bottom: 20px;">Student: ${student.name || "Unknown"}</h4>
            
            <div style="display: flex; gap: 10px; margin-bottom: 25px; text-align: center;">
                <div style="flex: 1; background: #e8f4f8; padding: 15px 10px; border-radius: 8px;">
                    <div style="font-size: 28px; font-weight: bold; color: #27ae60;">${presentCount}</div>
                    <div style="font-size: 12px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px;">Present</div>
                </div>
                <div style="flex: 1; background: #fdf2e9; padding: 15px 10px; border-radius: 8px;">
                    <div style="font-size: 28px; font-weight: bold; color: #f39c12;">${lateCount}</div>
                    <div style="font-size: 12px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px;">Late</div>
                </div>
                <div style="flex: 1; background: #fadbd8; padding: 15px 10px; border-radius: 8px;">
                    <div style="font-size: 28px; font-weight: bold; color: #e74c3c;">${absentCount}</div>
                    <div style="font-size: 12px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px;">Absent</div>
                </div>
            </div>

            <h4 style="margin-bottom: 10px; color: #34495e;">Recent History</h4>
            <div style="max-height: 300px; overflow-y: auto; border: 1px solid #eee; border-radius: 5px;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                    <thead style="position: sticky; top: 0; background: #ecf0f1;">
                        <tr><th style="padding: 10px;">Date</th><th style="padding: 10px;">Status</th></tr>
                    </thead>
                    <tbody>${historyHTML}</tbody>
                </table>
            </div>
        </div>
    `;
    
    attScreen.style.display = 'block';
};
// --- END OF NEW FUNCTION ---

// 🎯 NEW FUNCTION: Back to Parent Hub from any screen
window.backToParentHub = function() {
    const dbScreen = document.getElementById('parentDashboard');
    const annScreen = document.getElementById('parentAnnouncementsScreen');
    const attScreen = document.getElementById('parentAttendanceScreen');
    const stmtScreen = document.getElementById('parentStatementScreen');
    const hub = document.getElementById('parentHubDashboard');
    
    if(dbScreen) dbScreen.style.display = 'none';
    if(annScreen) annScreen.style.display = 'none';
    if(attScreen) attScreen.style.display = 'none';
    if(stmtScreen) stmtScreen.style.display = 'none';
    if(hub) hub.style.display = 'flex';
};

// 🎯 NEW FUNCTION: Show Parent Statement with Overpayment
window.showParentStatement = function() {
    if (typeof window.recordVisit === 'function') {
        const student = window.currentParentStudent || {};
        window.recordVisit(student.name || student.student_name || `Student ${student.id}`, 'Parent', 'Parent Page View', 'Account Statement & History');
    }
    document.getElementById('parentHubDashboard').style.display = 'none';
    
    let stmtScreen = document.getElementById('parentStatementScreen');
    if (!stmtScreen) {
        stmtScreen = document.createElement('div');
        stmtScreen.id = 'parentStatementScreen';
        stmtScreen.style.cssText = 'display: block; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #f4f7f6; z-index: 20000; overflow-y: auto; padding: 20px; box-sizing: border-box;';
        document.body.appendChild(stmtScreen);
    } else {
        stmtScreen.style.display = 'block';
    }
    
    const student = window.currentParentStudent || {};
    if (!student || !student.ledger || student.ledger.length === 0) {
        stmtScreen.innerHTML = `
            <div style="max-width: 700px; margin: 20px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <button onclick="backToParentHub()" style="background: none; border: none; color: #3498db; font-weight: bold; font-size: 15px; cursor: pointer; margin-bottom: 20px;">⬅ Back to Hub</button>
                <h2 style="color: #e74c3c; text-align: center;">No financial history found for this student.</h2>
                <p style="text-align: center; color: #7f8c8d;">Please contact the administration office if you have any questions.</p>
            </div>
        `;
        return;
    }

    const sortedLedger = [...student.ledger].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let statementLines = [];
    let unallocatedPaymentPool = 0;
    let totalBilled = 0, totalPaid = 0;
    
    sortedLedger.forEach(item => {
        if (item.status === 'VOID' || item.status === 'VOIDED') return;
        if (item.type !== 'charge') return;
        
        let amt = parseFloat(item.amount || 0) || 0;
        totalBilled += amt;
        let safeDesc = item.description || item.notes || 'General Charge';
        
        let matchedName = safeDesc.replace('Enrollment: ', '').replace('Event/Trip: ', '').replace('Payment for ', '').trim();
        let existing = statementLines.find(l => l.cleanName === matchedName);
        
        if (existing) existing.billed += amt;
        else statementLines.push({ date: item.date || 'N/A', desc: safeDesc, cleanName: matchedName, billed: amt, paid: 0 });
    });

    sortedLedger.forEach(item => {
        if (item.status === 'VOID' || item.status === 'VOIDED') return;
        if (['payment', 'waiver', 'discount', 'credit', 'overpayment'].includes(item.type)) {
            let pAmt = parseFloat(item.amount || 0) || 0;
            totalPaid += pAmt;
            
            if (item.breakdown && item.breakdown.length > 0) {
                item.breakdown.forEach(b => {
                    let bName = (b.desc || '').replace('Enrollment: ', '').replace('Event/Trip: ', '').trim();
                    let bAmt = parseFloat(b.amt) || 0;
                    let target = statementLines.find(l => l.cleanName.toLowerCase().includes(bName.toLowerCase()));
                    if (target) target.paid += bAmt;
                    else unallocatedPaymentPool += bAmt;
                });
            } else {
                let pName = (item.description || '').replace('Payment for ', '').trim();
                let target = statementLines.find(l => l.cleanName.toLowerCase().includes(pName.toLowerCase()));
                if (target) target.paid += pAmt;
                else unallocatedPaymentPool += pAmt;
            }
        }
    });

    let historyHTML = '';
    sortedLedger.filter(l => l.status !== 'VOID' && l.status !== 'VOIDED').forEach(item => {
        let date = item.date || new Date().toISOString().split('T')[0];
        let typeColor = item.type === 'charge' ? '#e74c3c' : (item.type === 'payment' || item.type === 'overpayment' ? '#27ae60' : '#f39c12');
        let typeIcon = item.type === 'charge' ? '📌' : (item.type === 'payment' || item.type === 'overpayment' ? '✅' : '💰');
        let amount = parseFloat(item.amount || 0) || 0;
        let method = item.method || (item.payment_notes || item.paymentmethod || '');
        
        let creditNote = '';
        if (item.credit_used > 0) {
            creditNote = ` <span style="color: #27ae60; font-weight: bold;">💳 (Used $${item.credit_used.toFixed(2)} from overpayment)</span>`;
        }
        
        historyHTML += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px; color: #555;">${date}</td>
                <td style="padding: 12px; color: #555;">${item.description || 'N/A'}</td>
                <td style="padding: 12px; text-align: right; color: ${typeColor}; font-weight: bold;">
                    ${typeIcon} $${amount.toFixed(2)}
                </td>
                <td style="padding: 12px; font-size: 12px; color: #7f8c8d;">${method}${creditNote}</td>
            </tr>
        `;
    });

    const finalBalance = totalBilled - totalPaid;
    const isCredit = finalBalance < -0.01;
    const displayBalance = Math.abs(finalBalance);
    
    const dateStr = new Date().toLocaleDateString();
    const schoolName = window.settings?.schoolName || 'Haven Online';
    
    stmtScreen.innerHTML = `
        <div style="max-width: 700px; margin: 20px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <button onclick="backToParentHub()" style="background: none; border: none; color: #3498db; font-weight: bold; font-size: 15px; cursor: pointer; margin-bottom: 20px;">⬅ Back to Hub</button>
            
            <h2 style="color: #2c3e50; margin: 0 0 5px 0; text-align: center; text-transform: uppercase;">${schoolName}</h2>
            <h4 style="text-align: center; color: #7f8c8d; margin-top: 0; margin-bottom: 20px;">Account Statement</h4>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #3498db;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span><strong>Student:</strong> ${student.name}</span>
                    <span><strong>ID:</strong> ${student.id}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span><strong>Class:</strong> ${student.grade || 'N/A'}</span>
                    <span><strong>Date:</strong> ${dateStr}</span>
                </div>
            </div>

            <h3 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">📋 Transaction History</h3>
            <div style="overflow-x: auto; margin-bottom: 20px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f0f0f0;">
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #bdc3c7;">Date</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #bdc3c7;">Description</th>
                            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #bdc3c7;">Amount</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #bdc3c7;">Details</th>
                        </tr>
                    </thead>
                    <tbody>${historyHTML}</tbody>
                </table>
            </div>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; border: 1px solid #bdc3c7;">
                <h3 style="margin: 0 0 15px 0; color: #2c3e50; border-bottom: 1px solid #bdc3c7; padding-bottom: 10px;">💰 Summary</h3>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #bdc3c7;">
                    <span style="font-weight: bold;">Total Billed:</span>
                    <span style="font-weight: bold;">$${totalBilled.toFixed(2)}</span>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #bdc3c7;">
                    <span style="font-weight: bold; color: #27ae60;">Total Paid:</span>
                    <span style="font-weight: bold; color: #27ae60;">-$${totalPaid.toFixed(2)}</span>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: ${isCredit ? '15px' : '0px'}; padding: 15px; background: ${isCredit ? '#ecfdf4' : 'white'}; border-radius: 4px; font-size: 18px; font-weight: bold; color: ${isCredit ? '#27ae60' : (finalBalance > 0.01 ? '#c0392b' : '#27ae60')}; border: ${isCredit ? '2px solid #27ae60' : 'none'};">
                    <span>${isCredit ? '💳 Credit Balance (Overpaid):' : 'Balance Due:'}</span>
                    <span>$${displayBalance.toFixed(2)}</span>
                </div>
                
                ${isCredit ? `
                <p style="font-size: 12px; color: #7f8c8d; margin: 10px 0 0 0; font-style: italic; text-align: center;">This credit can be used for future purchases like school events, uniforms, shop items, and other expenses.</p>
                ` : ''}
            </div>
            
            <div style="text-align: center; margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee; color: #7f8c8d; font-size: 12px;">
                <p>For any questions about your account, please contact the administration office.</p>
                <p>This statement was generated automatically on ${dateStr}</p>
            </div>
        </div>
    `;
};

window.closeParentPortal = function() {
    window.currentParentStudent = null;
    
    document.getElementById('parentStudentId').value = "";
    document.getElementById('parentPhone').value = "";
    
    const dbScreen = document.getElementById('parentDashboard');
    const annScreen = document.getElementById('parentAnnouncementsScreen');
    const attScreen = document.getElementById('parentAttendanceScreen');
    const stmtScreen = document.getElementById('parentStatementScreen');
    const hub = document.getElementById('parentHubDashboard');
    
    if(dbScreen) dbScreen.style.display = 'none';
    if(annScreen) annScreen.style.display = 'none';
    if(attScreen) attScreen.style.display = 'none';
    if(stmtScreen) stmtScreen.style.display = 'none';
    if(hub) hub.style.display = 'none';
};