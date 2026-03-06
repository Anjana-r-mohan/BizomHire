const API = "http://localhost:3000";

let allJobs = [];
let currentFilters = { department: "", role: "", level: "", status: "" };

async function loadJobs() {
    const res = await fetch(API + "/jobs");
    allJobs = await res.json();
    applyFilters();
}

function applyFilters() {
    currentFilters.department = document.getElementById("filterDept").value;
    currentFilters.role = document.getElementById("filterRole").value;
    currentFilters.level = document.getElementById("filterLevel").value;
    currentFilters.status = document.getElementById("filterStatus").value;

    let filtered = allJobs.filter(j => {
        if (currentFilters.department && j.department !== currentFilters.department) return false;
        if (currentFilters.role && j.role !== currentFilters.role) return false;
        if (currentFilters.level && j.level !== currentFilters.level) return false;
        if (currentFilters.status && j.status !== currentFilters.status) return false;
        return true;
    });

    renderJobs(filtered);
}

function clearFilters() {
    document.getElementById("filterDept").value = "";
    document.getElementById("filterRole").value = "";
    document.getElementById("filterLevel").value = "";
    document.getElementById("filterStatus").value = "";
    currentFilters = { department: "", role: "", level: "", status: "" };
    applyFilters();
}

function renderJobs(jobs) {
    const tbody = document.querySelector("#jobTable tbody");
    tbody.innerHTML = "";

    let offers = 0;
    let joined = 0;

    jobs.forEach(j => {
        if(j.status==="Offered") offers++;
        if(j.status==="Joined") joined++;

        // Determine TAT color (text only)
        let tatColor = "";
        let tatDisplay = j.actual_tat || "";
        
        if (j.actual_tat && j.expected_tat) {
            const daysRemaining = j.expected_tat - j.actual_tat;
            
            if (j.actual_tat > j.expected_tat) {
                // Over expected TAT - Red text
                tatColor = "color: #dc3545; font-weight: bold;";
            } else if (daysRemaining <= 3) {
                // Within 3 days of expected TAT - Amber text
                tatColor = "color: #fd7e14; font-weight: bold;";
            } else {
                // Under expected TAT with buffer - Green text
                tatColor = "color: #28a745; font-weight: bold;";
            }
        }

        // Status badge colors
        let statusBadge = "";
        switch(j.status) {
            case "Published":
                statusBadge = '<span class="badge bg-primary">Published</span>';
                break;
            case "Offered":
                statusBadge = '<span class="badge bg-info">Offered</span>';
                break;
            case "Joined":
                statusBadge = '<span class="badge bg-success">Joined</span>';
                break;
            case "Rejected":
                statusBadge = '<span class="badge bg-secondary">Rejected</span>';
                break;
            default:
                statusBadge = `<span class="badge bg-light text-dark">${j.status}</span>`;
        }

        tbody.innerHTML += `
        <tr>
        <td><strong>${j.department}</strong></td>
        <td>${j.role}</td>
        <td>${j.level}</td>
        <td>${statusBadge}</td>
        <td>${j.posted_date}</td>
        <td>${j.offered_date||"—"}</td>
        <td class="text-center">${j.expected_tat || "—"}</td>
        <td class="text-center"><span style="${tatColor}">${tatDisplay || "—"}</span></td>
        <td><span class="badge bg-light text-dark">${j.hr_name || "—"}</span></td>
        <td>
            <button class="btn btn-sm btn-warning" onclick="editJob(${j.id})">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteJob(${j.id})">Delete</button>
        </td>
        </tr>
        `;
    });

    document.getElementById("total").innerText = allJobs.length;
    document.getElementById("offers").innerText = offers;
    document.getElementById("joined").innerText = joined;
}

async function addJob(){
    const expectedTat = document.getElementById("expectedTAT") ? document.getElementById("expectedTAT").value : 7;
    const hrName = document.getElementById("hrName") ? document.getElementById("hrName").value : "";
    
    if (!hrName.trim()) {
        alert("Please enter your name (HR)");
        return;
    }
    
    const job = {
        department: document.getElementById("department").value,
        role: document.getElementById("role").value,
        level: document.getElementById("level").value,
        status:"Published",
        posted_date: document.getElementById("posted").value,
        expected_tat: expectedTat || 7,
        hr_name: hrName
    };

    await fetch(API+"/jobs",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(job)
    });

    document.getElementById("department").value = "";
    document.getElementById("role").value = "";
    document.getElementById("level").value = "";
    document.getElementById("posted").value = "";
    document.getElementById("hrName").value = "";
    if (document.getElementById("expectedTAT")) document.getElementById("expectedTAT").value = "7";

    loadJobs();
}

async function editJob(id) {
    const job = allJobs.find(j => j.id === id);
    
    document.getElementById("editId").value = job.id;
    document.getElementById("editDept").value = job.department;
    document.getElementById("editRole").value = job.role;
    document.getElementById("editLevel").value = job.level;
    document.getElementById("editStatus").value = job.status;
    document.getElementById("editPosted").value = job.posted_date;
    document.getElementById("editOffered").value = job.offered_date || "";
    document.getElementById("editTAT").value = job.expected_tat;
    document.getElementById("editHRName").value = job.hr_name || "";

    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    modal.show();
}

async function saveEdit() {
    const id = document.getElementById("editId").value;
    const job = {
        department: document.getElementById("editDept").value,
        role: document.getElementById("editRole").value,
        level: document.getElementById("editLevel").value,
        status: document.getElementById("editStatus").value,
        posted_date: document.getElementById("editPosted").value,
        offered_date: document.getElementById("editOffered").value,
        expected_tat: document.getElementById("editTAT").value,
        hr_name: document.getElementById("editHRName").value
    };

    await fetch(API+"/jobs/"+id, {
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(job)
    });

    bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
    loadJobs();
}

async function deleteJob(id) {
    if (!confirm("Delete this job opening?")) return;
    
    await fetch(API+"/jobs/"+id, {method:"DELETE"});
    loadJobs();
}

function exportJobs() {
    const params = new URLSearchParams(currentFilters);
    window.location.href = API + "/export?" + params.toString();
}

async function bulkUpload() {
    const fileInput = document.getElementById("bulkFile");
    if (!fileInput.files.length) {
        alert("Please select a CSV file");
        return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    const res = await fetch(API + "/jobs/bulk", {
        method: "POST",
        body: formData
    });

    const result = await res.json();
    alert(`Uploaded ${result.count} jobs successfully`);
    fileInput.value = "";
    loadJobs();
}

// Department functions
async function loadDepartments() {
    const res = await fetch(API + "/departments");
    const departments = await res.json();
    
    const selects = ["department", "editDept", "filterDept"];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        const isFilter = selectId === "filterDept";
        
        select.innerHTML = isFilter ? '<option value="">All Departments</option>' : '<option value="">Select Department</option>';
        departments.forEach(d => {
            select.innerHTML += `<option value="${d.name}">${d.name}</option>`;
        });
        
        if (currentValue) select.value = currentValue;
    });

    const list = document.getElementById("deptList");
    list.innerHTML = "";
    departments.forEach(d => {
        list.innerHTML += `
        <li class="list-group-item d-flex justify-content-between">
            ${d.name}
            <button class="btn btn-sm btn-danger" onclick="deleteDepartment(${d.id})">Delete</button>
        </li>`;
    });
}

async function addDepartment() {
    const name = document.getElementById("newDept").value.trim();
    if (!name) return;

    await fetch(API + "/departments", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ name })
    });

    document.getElementById("newDept").value = "";
    loadDepartments();
}

async function deleteDepartment(id) {
    await fetch(API + "/departments/" + id, {method: "DELETE"});
    loadDepartments();
}

// Role functions
async function loadRoles() {
    const res = await fetch(API + "/roles");
    const roles = await res.json();
    
    const selects = ["role", "editRole", "filterRole"];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        const isFilter = selectId === "filterRole";
        
        select.innerHTML = isFilter ? '<option value="">All Roles</option>' : '<option value="">Select Role</option>';
        roles.forEach(r => {
            select.innerHTML += `<option value="${r.name}">${r.name}</option>`;
        });
        
        if (currentValue) select.value = currentValue;
    });

    const list = document.getElementById("roleList");
    list.innerHTML = "";
    roles.forEach(r => {
        list.innerHTML += `
        <li class="list-group-item d-flex justify-content-between">
            ${r.name}
            <button class="btn btn-sm btn-danger" onclick="deleteRole(${r.id})">Delete</button>
        </li>`;
    });
}

async function addRole() {
    const name = document.getElementById("newRole").value.trim();
    if (!name) return;

    await fetch(API + "/roles", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ name })
    });

    document.getElementById("newRole").value = "";
    loadRoles();
}

async function deleteRole(id) {
    await fetch(API + "/roles/" + id, {method: "DELETE"});
    loadRoles();
}

// Level functions
async function loadLevels() {
    const res = await fetch(API + "/levels");
    const levels = await res.json();
    
    const selects = ["level", "editLevel", "filterLevel"];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        const isFilter = selectId === "filterLevel";
        
        select.innerHTML = isFilter ? '<option value="">All Levels</option>' : '<option value="">Select Level</option>';
        levels.forEach(l => {
            select.innerHTML += `<option value="${l.name}">${l.name}</option>`;
        });
        
        if (currentValue) select.value = currentValue;
    });

    const list = document.getElementById("levelList");
    list.innerHTML = "";
    levels.forEach(l => {
        list.innerHTML += `
        <li class="list-group-item d-flex justify-content-between">
            ${l.name}
            <button class="btn btn-sm btn-danger" onclick="deleteLevel(${l.id})">Delete</button>
        </li>`;
    });
}

async function addLevel() {
    const name = document.getElementById("newLevel").value.trim();
    if (!name) return;

    await fetch(API + "/levels", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ name })
    });

    document.getElementById("newLevel").value = "";
    loadLevels();
}

async function deleteLevel(id) {
    await fetch(API + "/levels/" + id, {method: "DELETE"});
    loadLevels();
}

// Initialize
loadJobs();
loadDepartments();
loadRoles();
loadLevels();

// Set current date in header
const today = new Date();
const options = { year: 'numeric', month: 'long', day: 'numeric' };
document.getElementById('currentDate').textContent = today.toLocaleDateString('en-US', options);