# Staff Management Architecture: Current vs Proposed Solution

## Current System: Two Different Staff Types

### 1. **Teacher Registration & Deployment** (Line 2116 in index.html)
**Purpose:** Register qualified teachers with teaching capabilities
**Saves in:** `window.staffAccounts` (or `window.staff`)
**Function:** `registerStaff()` (Line 12964)
**Accessible to:** Level 2+ Admins

**Fields Captured:**
- Full Name ✅
- Username ✅ (Required for login)
- Password ✅ (Required for login)
- System Access Role (Level 1/2/3) ✅
- Teacher Type (Primary, Secondary, None) ✅
- Teaching Capabilities (Grades/Subjects) ✅

**Deployment Options:**
- Assign to specific Class/Grade
- Assign specific Subject
- Deploy to classroom

**Database Storage:** `student_ledger` or custom table

---

### 2. **User Management** (Line 1188 in index.html - Settings Tab)
**Purpose:** Create system user accounts with login access
**Saves in:** `window.users`
**Function:** `createNewUser()` (Line 7505)
**Accessible to:** Level 3 Only (Chief Admin)

**Fields Captured:**
- Staff Name ✅
- Password ✅ (Required for login)
- Role (Level 1/2/3) ✅

**Database Storage:** `users` table in Supabase

**NO Other Info:** No phone, no vehicle, no qualifications

---

## The Problem: Your Three Staff Types

Current system is designed for TEACHERS only. You need:

```
1. DRIVERS
   ├─ Name & Surname (required)
   ├─ Phone (required)
   ├─ Vehicle (required)
   ├─ Route Assigned (G1-G5, can be multiple)
   ├─ Centre Assignment (G1-G5)
   ├─ NO Username/Password (non-system users)
   └─ Appears in: Payroll, Transport tracking, Vehicle records

2. AUXILIARY STAFF
   ├─ Name (required)
   ├─ Phone (required)
   ├─ Job Description (e.g., "Cleaner", "Guard", "Cook")
   ├─ Centre Assignment (G1-G5)
   ├─ NO Username/Password (unless they need system access)
   └─ Appears in: Payroll

3. TEACHERS (Already Supported)
   ├─ Name (required)
   ├─ Username & Password (required for login)
   ├─ Teaching Qualifications
   ├─ Centre Assignment (G1-G5)
   └─ Appears in: Deployment, Academics, Payroll
```

---

## Proposed Solution

### New Data Structure: Unified Staff System

Create ONE comprehensive staff system with three roles:

```javascript
window.staffRegistry = [
    {
        id: 'STAFF-001',
        name: 'John Dube',
        surname: 'Dube',
        phone: '0772345678',
        
        // Staff Type (determines which fields are used)
        staffType: 'teacher' | 'driver' | 'auxiliary',
        
        // Centre Assignment (ALL staff need this)
        centre: 'G1',  // Primary centre
        centreAssignments: ['G1', 'G2'],  // Can work at multiple centres
        
        // LOGIN ACCESS (optional, not required for drivers/aux)
        hasLoginAccess: true/false,
        username: 'jdube',
        password: 'hashed_password',
        role: 'Level 1',  // System access level if they have login
        
        // TEACHER-SPECIFIC FIELDS
        teacherType: 'Primary',  // or 'Secondary'
        qualifiedGrades: ['Grade 1', 'Grade 2'],
        qualifiedSubjects: ['Mathematics', 'English'],
        deployments: [
            { class: 'Grade 1A', subject: 'Mathematics', startDate: '2026-01-01' }
        ],
        
        // DRIVER-SPECIFIC FIELDS
        vehicleType: 'Van',  // Type of vehicle
        vehicleRegistration: 'ABU 1234',
        routes: ['G1-G2', 'G2-G3'],  // Multiple routes possible
        licenseNumber: 'ZW123456',
        licenseExpiry: '2027-12-31',
        
        // AUXILIARY-SPECIFIC FIELDS
        jobDescription: 'Cleaner',
        department: 'Maintenance',
        
        // PAYROLL (ALL staff types)
        salary: 2500,
        paymentMethod: 'Bank Transfer',  // EcoCash, Cash, etc.
        bankAccount: 'ACCOUNT123',
        active: true,
        
        // AUDIT TRAIL
        dateAdded: '2026-01-15',
        addedBy: 'admin_user_id',
        lastModified: '2026-02-01',
        modifiedBy: 'admin_user_id'
    }
]
```

---

## Implementation Approach

### Phase 1: Create Unified Staff Registry Form
Create ONE form that adapts based on staff type selection:

```html
<div class="card">
    <h3>Staff Registration & Management</h3>
    
    <!-- STAFF TYPE SELECTOR (Shows/hides relevant fields) -->
    <select id="staffTypeSelector" onchange="toggleStaffFields()">
        <option value="teacher">Teacher</option>
        <option value="driver">Driver</option>
        <option value="auxiliary">Auxiliary Staff</option>
    </select>
    
    <!-- COMMON FIELDS (All staff types) -->
    <input id="staffName" placeholder="First Name">
    <input id="staffSurname" placeholder="Surname">
    <input id="staffPhone" placeholder="Phone Number">
    
    <!-- CENTRE ASSIGNMENT (All staff) -->
    <select id="staffCentre">
        <option value="G1">G1</option>
        <option value="G2">G2</option>
        <option value="G3">G3</option>
        <option value="G4">G4</option>
        <option value="G5">G5</option>
    </select>
    
    <!-- TEACHER-SPECIFIC (Hidden by default) -->
    <div id="teacherFields" style="display: none;">
        <label>Qualified Grades</label>
        <input id="teacherGrades" placeholder="Grade 1, Grade 2...">
        <label>Qualified Subjects</label>
        <input id="teacherSubjects" placeholder="Math, English...">
    </div>
    
    <!-- DRIVER-SPECIFIC (Hidden by default) -->
    <div id="driverFields" style="display: none;">
        <label>Vehicle Type</label>
        <input id="vehicleType" placeholder="Van, Sedan, etc.">
        <label>Vehicle Registration</label>
        <input id="vehicleReg" placeholder="ABU 1234">
        <label>Routes Assigned</label>
        <div>
            <checkbox>G1 ↔ G2</checkbox>
            <checkbox>G2 ↔ G3</checkbox>
            <checkbox>G3 ↔ G4</checkbox>
        </div>
    </div>
    
    <!-- AUXILIARY-SPECIFIC (Hidden by default) -->
    <div id="auxiliaryFields" style="display: none;">
        <label>Job Description</label>
        <input id="jobDesc" placeholder="Cleaner, Guard, Cook...">
        <label>Department</label>
        <input id="department" placeholder="Maintenance, Security...">
    </div>
    
    <!-- LOGIN ACCESS (Optional for all) -->
    <checkbox id="needsLogin" onchange="toggleLoginFields()">
        Grant System Login Access
    </checkbox>
    
    <!-- LOGIN FIELDS (Hidden by default) -->
    <div id="loginFields" style="display: none;">
        <input id="staffUsername" placeholder="Username">
        <input id="staffPassword" type="password" placeholder="Password">
        <select id="staffRole">
            <option value="Level 1">Level 1 (View Only)</option>
            <option value="Level 2">Level 2 (Admin)</option>
            <option value="Level 3">Level 3 (Chief Admin)</option>
        </select>
    </div>
    
    <!-- PAYROLL INFO -->
    <label>Monthly Salary</label>
    <input id="staffSalary" type="number" placeholder="Salary amount">
    <select id="paymentMethod">
        <option value="Bank Transfer">Bank Transfer</option>
        <option value="EcoCash">EcoCash</option>
        <option value="Cash">Cash</option>
    </select>
    
    <button onclick="saveStaffMember()">💾 Save Staff Member</button>
</div>
```

### Phase 2: Create Staff Directory with Filtering
```
Staff Directory (Filter by: Teacher | Driver | Auxiliary | All)

| Centre | Name | Type | Phone | Assignment | Payroll | Action |
|--------|------|------|-------|------------|---------|--------|
| G1 | John Dube | Teacher | 0772345678 | Grade 1A (Math) | $2500 | ✏️ 🗑️ |
| G1,G2 | Peter Mwale | Driver | 0779876543 | G1→G2, G2→G3 | $1800 | ✏️ 🗑️ |
| G3 | Jane Moyo | Auxiliary | 0771111111 | Cleaner | $500 | ✏️ 🗑️ |
```

### Phase 3: Update Payroll System
```
Payroll Disbursement

Staff Type: [All ▼] Centre: [All ▼]

[List showing all staff types: Teachers, Drivers, Auxiliary]

| Name | Type | Salary | Centre | Status | Action |
|------|------|--------|--------|--------|--------|
| John Dube | Teacher | $2500 | G1 | Pending | ✔️ |
| Peter Mwale | Driver | $1800 | G1,G2 | Pending | ✔️ |
| Jane Moyo | Auxiliary | $500 | G3 | Pending | ✔️ |
```

### Phase 4: Create Route/Transport Tracking for Drivers
```
Driver & Vehicle Management

| Driver | Centre | Vehicle | Routes | Phone | Status |
|--------|--------|---------|--------|-------|--------|
| Peter Mwale | G1,G2 | Van ABU1234 | G1→G2, G2→G3 | 0779876543 | Active |
```

---

## Database Schema

### New Table: `staff_registry`
```sql
CREATE TABLE staff_registry (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    surname TEXT,
    phone TEXT NOT NULL,
    staff_type TEXT NOT NULL,  -- 'teacher', 'driver', 'auxiliary'
    centre TEXT NOT NULL,  -- Primary centre
    centre_assignments TEXT,  -- JSON: ['G1', 'G2']
    
    -- Login Access
    has_login_access BOOLEAN DEFAULT false,
    username TEXT UNIQUE,
    password_hash TEXT,
    role TEXT,
    
    -- Teacher Fields
    teacher_type TEXT,
    qualified_grades TEXT,  -- JSON array
    qualified_subjects TEXT,  -- JSON array
    
    -- Driver Fields
    vehicle_type TEXT,
    vehicle_registration TEXT,
    routes TEXT,  -- JSON array
    license_number TEXT,
    license_expiry TEXT,
    
    -- Auxiliary Fields
    job_description TEXT,
    department TEXT,
    
    -- Payroll
    salary DECIMAL(10,2),
    payment_method TEXT,
    bank_account TEXT,
    active BOOLEAN DEFAULT true,
    
    -- Audit
    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by TEXT,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by TEXT
);
```

### Maintain Compatibility
Keep existing tables but link them:
- `users` table: Reference to `staff_registry` by username
- `student_ledger` (payroll entries): Reference to `staff_registry` by ID
- `teachers` table: Subset of `staff_registry` where `staff_type = 'teacher'`

---

## Benefits of This Approach

✅ **ONE staff registration system** instead of two
✅ **Consistent centre tracking** for all staff types
✅ **Flexible login access** (drivers/aux can skip passwords)
✅ **Unified payroll** for all staff types
✅ **Route tracking** for drivers
✅ **Audit trail** for all changes
✅ **Scalable** for future staff types
✅ **Backward compatible** with existing data

---

## Migration Plan

1. Create `staff_registry` table
2. Migrate existing users from `users` to `staff_registry` (teacher role)
3. Migrate existing staff from `student_ledger` payroll entries
4. Create new registration UI
5. Phase out old registration forms
6. Update all modules to reference new table

---

## Quick Summary

**Current:** Two separate systems (Teachers + System Users)  
**Proposed:** One unified registry with three staff types  
**Key Addition:** Centre field for all staff  
**Impact:** Simpler management, better tracking, supports all your requirements

---

Would you like me to implement this solution? I can:
1. Create the new registration form
2. Build the database schema
3. Update payroll system
4. Create driver/vehicle tracking
5. Migrate existing data
