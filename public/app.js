// Use relative path for API to work both locally and in production
const API = window.location.hostname === 'localhost' 
    ? "http://localhost:3000" 
    : "";

let allJobs = [];
let filteredJobs = [];
let currentFilters = { department: "", role: "", level: "", status: "", dateFrom: "", dateTo: "" };
let currentPage = 1;
let itemsPerPage = 25;
let sortColumn = null;
let sortDirection = 'asc';

// Check authentication on page load
async function checkAuth() {
    try {
        const res = await fetch(API + "/auth/status");
        const data = await res.json();
        
        if (!data.authenticated) {
            // Redirect to login if not authenticated
            window.location.href = '/login.html';
            return false;
        }
        
        // Display user email in the UI
        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl && data.email) {
            userEmailEl.textContent = data.email;
        }
        
        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login.html';
        return false;
    }
}

// Logout function
async function handleLogout() {
    try {
        await fetch(API + '/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout failed:', error);
        window.location.href = '/login.html';
    }
}

// Helper function to convert DD-MM-YYYY to YYYY-MM-DD for date inputs
function convertToInputFormat(dateStr) {
    if (!dateStr) return "";
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }
    
    // Parse DD-MM-YYYY format
    const parts = dateStr.split(/[-\/]/);
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }
    
    return "";
}

async function loadJobs() {
    try {
        console.log("Loading jobs from:", API + "/jobs");
        const res = await fetch(API + "/jobs");
        
        if (res.status === 401) {
            // Session expired, redirect to login
            window.location.href = '/login.html';
            return;
        }
        
        if (!res.ok) {
            throw new Error(`Failed to load jobs: ${res.status} ${res.statusText}`);
        }
        
        allJobs = await res.json();
        console.log("Loaded jobs:", allJobs.length);
        applyFilters();
    } catch (error) {
        console.error("Error loading jobs:", error);
        if (error.message.includes('401')) {
            window.location.href = '/login.html';
        } else {
            alert("Error loading jobs: " + error.message);
        }
    }
}

// Helper function to parse dates in DD-MM-YYYY format
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    const str = dateStr.toString().trim();
    
    // Check if it's YYYY-MM-DD format (from HTML date inputs)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const parts = str.split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const day = parseInt(parts[2]);
        return new Date(year, month - 1, day); // month is 0-indexed
    }
    
    // Handle text months like "7-Jan-2026" or "7-January-2026"
    const monthNames = {
        'jan': 0, 'january': 0,
        'feb': 1, 'february': 1,
        'mar': 2, 'march': 2,
        'apr': 3, 'april': 3,
        'may': 4,
        'jun': 5, 'june': 5,
        'jul': 6, 'july': 6,
        'aug': 7, 'august': 7,
        'sep': 8, 'september': 8,
        'oct': 9, 'october': 9,
        'nov': 10, 'november': 10,
        'dec': 11, 'december': 11
    };
    
    // Try DD-MM-YYYY or DD-M-YYYY or D-MM-YYYY format (from Excel)
    const parts = str.split(/[-\/]/);
    if (parts.length === 3) {
        const day = parseInt(parts[0]);
        let month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        
        // Check if middle part is a text month
        if (isNaN(month)) {
            const monthText = parts[1].toLowerCase();
            month = monthNames[monthText];
            if (month !== undefined) {
                return new Date(year, month, day);
            }
        }
        
        // If day > 12, it's definitely DD-MM-YYYY format
        // If month > 12, it's definitely MM-DD-YYYY format (swap them)
        if (month > 12) {
            return new Date(year, day - 1, month); // MM-DD-YYYY (swap day and month)
        } else if (day > 12) {
            return new Date(year, month - 1, day); // DD-MM-YYYY
        } else {
            // Assume DD-MM-YYYY (international format)
            return new Date(year, month - 1, day);
        }
    }
    
    // Fallback to native parsing
    return new Date(str);
}

function calculateBusinessDays(startDate, endDate) {
    let start = parseDate(startDate);
    let end = parseDate(endDate);
    
    if (!start || !end || isNaN(start) || isNaN(end)) {
        return null;
    }
    
    let count = 0;

    while (start <= end) {
        let day = start.getDay();
        if (day !== 0 && day !== 6) count++; // Exclude Saturday (6) and Sunday (0)
        start.setDate(start.getDate() + 1);
    }

    return count;
}

function applyFilters() {
    currentFilters.department = document.getElementById("filterDept").value;
    currentFilters.role = document.getElementById("filterRole").value;
    currentFilters.level = document.getElementById("filterLevel").value;
    currentFilters.status = document.getElementById("filterStatus").value;
    currentFilters.dateFrom = document.getElementById("filterDateFrom").value;
    currentFilters.dateTo = document.getElementById("filterDateTo").value;
    
    currentPage = 1; // Reset to first page when filters change

    let filtered = allJobs.filter(j => {
        // Declare statusLower once for the entire filter function
        const statusLower = (j.status || "").toLowerCase();
        
        if (currentFilters.department && j.department !== currentFilters.department) return false;
        if (currentFilters.role && j.role !== currentFilters.role) return false;
        if (currentFilters.level && j.level !== currentFilters.level) return false;
        
        // Special filter for TAT Exceeded - case insensitive
        if (currentFilters.status === "TAT_EXCEEDED") {
            // Only Open jobs (not Offered or Joined)
            if (statusLower !== "open") return false;
            
            // Calculate business days from posted_date to today
            if (j.posted_date && j.expected_tat) {
                const today = new Date().toISOString().split('T')[0];
                const currentTAT = calculateBusinessDays(j.posted_date, today);
                
                // Only show if TAT exceeded
                if (currentTAT <= j.expected_tat) return false;
            } else {
                return false; // Skip if no posted_date or expected_tat
            }
        } else if (currentFilters.status) {
            // Case insensitive status comparison
            const filterLower = currentFilters.status.toLowerCase();
            if (statusLower !== filterLower) return false;
        }
        
        // Date range filter
        if (currentFilters.dateFrom && j.posted_date) {
            if (j.posted_date < currentFilters.dateFrom) return false;
        }
        if (currentFilters.dateTo && j.posted_date) {
            if (j.posted_date > currentFilters.dateTo) return false;
        }
        
        return true;
    });

    filteredJobs = filtered;
    console.log("Filtered jobs:", filteredJobs.length, "Current page:", currentPage, "Items per page:", itemsPerPage);
    renderJobs(filtered);
}

function clearFilters() {
    document.getElementById("filterDept").value = "";
    document.getElementById("filterRole").value = "";
    document.getElementById("filterLevel").value = "";
    document.getElementById("filterStatus").value = "";
    document.getElementById("filterDateFrom").value = "";
    document.getElementById("filterDateTo").value = "";
    currentFilters = { department: "", role: "", level: "", status: "", dateFrom: "", dateTo: "" };
    applyFilters();
}

function renderJobs(jobs) {
    // Apply sorting if a column is selected
    if (sortColumn) {
        jobs.sort((a, b) => {
            let aVal = a[sortColumn];
            let bVal = b[sortColumn];
            
            // Handle null/undefined
            if (aVal === null || aVal === undefined) aVal = "";
            if (bVal === null || bVal === undefined) bVal = "";
            
            // Convert to strings for comparison
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();
            
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    // Calculate pagination
    const totalItems = jobs.length;
    const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPage);
    const startIndex = itemsPerPage === 'all' ? 0 : (currentPage - 1) * itemsPerPage;
    const endIndex = itemsPerPage === 'all' ? totalItems : startIndex + parseInt(itemsPerPage);
    const paginatedJobs = jobs.slice(startIndex, endIndex);
    
    const tbody = document.querySelector("#jobTable tbody");
    tbody.innerHTML = "";

    let offers = 0;
    let joined = 0;

    // Count from all jobs (not just current page) - case insensitive
    allJobs.forEach(j => {
        const status = (j.status || "").toLowerCase();
        if(status === "offered") offers++;
        if(status === "joined") joined++;
    });

    paginatedJobs.forEach(j => {
        const statusLower = (j.status || "").toLowerCase();
        
        // Actual TAT - Single column for all statuses
        let actualTATColor = "";
        let actualTATDisplay = "—";
        
        if (statusLower === "open" && j.posted_date && j.expected_tat) {
            // For Open jobs: Calculate TAT from posted_date to today (dynamic, increments daily)
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const daysOpen = calculateBusinessDays(j.posted_date, todayStr);
            
            if (daysOpen !== null && daysOpen !== undefined) {
                const daysRemaining = j.expected_tat - daysOpen;
                
                if (daysOpen > j.expected_tat) {
                    // Over expected TAT - Red text
                    actualTATColor = "color: #dc3545; font-weight: bold;";
                } else if (daysRemaining <= 3) {
                    // Within 3 days of expected TAT - Amber text
                    actualTATColor = "color: #fd7e14; font-weight: bold;";
                } else {
                    // Under expected TAT with buffer - Green text
                    actualTATColor = "color: #28a745; font-weight: bold;";
                }
                
                actualTATDisplay = daysOpen;
            }
        } else if (statusLower === "offered" || statusLower === "joined") {
            // For Offered/Joined: Show TAT from posted_date to offered_date (fixed)
            const actualTAT = j.actual_tat;
            
            if (actualTAT !== null && actualTAT !== undefined && j.expected_tat) {
                const daysRemaining = j.expected_tat - actualTAT;
                
                if (actualTAT > j.expected_tat) {
                    // Over expected TAT - Red text
                    actualTATColor = "color: #dc3545; font-weight: bold;";
                } else if (daysRemaining <= 3) {
                    // Within 3 days of expected TAT - Amber text
                    actualTATColor = "color: #fd7e14; font-weight: bold;";
                } else {
                    // Under expected TAT with buffer - Green text
                    actualTATColor = "color: #28a745; font-weight: bold;";
                }
                
                actualTATDisplay = actualTAT;
            } else if (actualTAT !== null && actualTAT !== undefined) {
                actualTATDisplay = actualTAT;
            }
        }

        // Status badge colors - use statusLower already declared above
        let statusBadge = "";
        switch(statusLower) {
            case "open":
                statusBadge = '<span class="badge bg-primary">Open</span>';
                break;
            case "offered":
                statusBadge = '<span class="badge bg-info">Offered</span>';
                break;
            case "joined":
                statusBadge = '<span class="badge bg-success">Joined</span>';
                break;
            default:
                statusBadge = `<span class="badge bg-light text-dark">${j.status}</span>`;
        }

        tbody.innerHTML += `
        <tr>
        <td><strong>${j.department}</strong></td>
        <td>${j.role}</td>
        <td>${j.level}</td>
        <td>${j.location || "—"}</td>
        <td>${statusBadge}</td>
        <td>${j.posted_date}</td>
        <td>${j.offered_date||"—"}</td>
        <td class="text-center">${j.expected_tat || "—"}</td>
        <td class="text-center"><span style="${actualTATColor}">${actualTATDisplay}</span></td>
        <td>
            <button class="btn btn-sm btn-warning" onclick="editJob('${j.id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteJob('${j.id}')">Delete</button>
        </td>
        </tr>
        `;
    });

    document.getElementById("total").innerText = allJobs.length;
    document.getElementById("offers").innerText = offers;
    document.getElementById("joined").innerText = joined;
    
    // Update pagination controls
    updatePaginationControls(totalItems, totalPages, startIndex, endIndex);
}

function updatePaginationControls(totalItems, totalPages, startIndex, endIndex) {
    const paginationDiv = document.getElementById("paginationControls");
    if (!paginationDiv) {
        console.error("paginationControls div not found");
        return;
    }
    
    console.log("Updating pagination:", {totalItems, totalPages, currentPage, itemsPerPage});
    
    const displayStart = totalItems === 0 ? 0 : startIndex + 1;
    const displayEnd = Math.min(endIndex, totalItems);
    
    const isPrevDisabled = currentPage === 1 || itemsPerPage === 'all';
    const isNextDisabled = currentPage === totalPages || itemsPerPage === 'all';
    
    console.log("Pagination buttons:", {isPrevDisabled, isNextDisabled, currentPage, totalPages});
    
    paginationDiv.innerHTML = '';
    
    const container = document.createElement('div');
    container.className = 'd-flex justify-content-between align-items-center';
    
    // Left side - showing text
    const leftDiv = document.createElement('div');
    leftDiv.innerHTML = `<span class="text-muted">Showing ${displayStart} - ${displayEnd} of ${totalItems} openings</span>`;
    
    // Right side - controls
    const rightDiv = document.createElement('div');
    rightDiv.className = 'd-flex align-items-center';
    rightDiv.style.gap = '10px';
    
    // Items per page select
    const select = document.createElement('select');
    select.id = 'itemsPerPageSelect';
    select.className = 'form-select form-select-sm';
    select.style.width = 'auto';
    select.innerHTML = `
        <option value="10" ${itemsPerPage == 10 ? 'selected' : ''}>10 per page</option>
        <option value="25" ${itemsPerPage == 25 ? 'selected' : ''}>25 per page</option>
        <option value="50" ${itemsPerPage == 50 ? 'selected' : ''}>50 per page</option>
        <option value="100" ${itemsPerPage == 100 ? 'selected' : ''}>100 per page</option>
        <option value="all" ${itemsPerPage === 'all' ? 'selected' : ''}>Show All</option>
    `;
    select.addEventListener('change', changeItemsPerPage);
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-sm btn-outline-secondary';
    prevBtn.textContent = 'Previous';
    prevBtn.disabled = isPrevDisabled;
    if (!isPrevDisabled) {
        prevBtn.addEventListener('click', () => {
            console.log('Previous button clicked, calling previousPage()');
            previousPage();
        });
    }
    
    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.className = 'text-muted';
    pageInfo.textContent = `${itemsPerPage === 'all' ? '1' : currentPage} / ${totalPages}`;
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-sm btn-outline-secondary';
    nextBtn.textContent = 'Next';
    nextBtn.disabled = isNextDisabled;
    if (!isNextDisabled) {
        nextBtn.addEventListener('click', () => {
            console.log('Next button clicked, calling nextPage()');
            nextPage();
        });
    }
    
    // Assemble everything
    rightDiv.appendChild(select);
    rightDiv.appendChild(prevBtn);
    rightDiv.appendChild(pageInfo);
    rightDiv.appendChild(nextBtn);
    
    container.appendChild(leftDiv);
    container.appendChild(rightDiv);
    
    paginationDiv.appendChild(container);
    
    console.log("Pagination controls created successfully");
}

function sortBy(column) {
    if (sortColumn === column) {
        // Toggle direction
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    applyFilters();
}

function changeItemsPerPage() {
    const select = document.getElementById("itemsPerPageSelect");
    itemsPerPage = select.value === 'all' ? 'all' : parseInt(select.value);
    currentPage = 1;
    applyFilters();
}

function previousPage() {
    console.log("previousPage called, currentPage:", currentPage);
    if (currentPage > 1) {
        currentPage--;
        console.log("Moving to page:", currentPage);
        renderJobs(filteredJobs);
    }
}

function nextPage() {
    console.log("nextPage called, currentPage:", currentPage, "itemsPerPage:", itemsPerPage);
    if (itemsPerPage === 'all') return;
    
    const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
    console.log("totalPages:", totalPages, "filteredJobs.length:", filteredJobs.length);
    if (currentPage < totalPages) {
        currentPage++;
        console.log("Moving to page:", currentPage);
        renderJobs(filteredJobs);
    }
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
        location: document.getElementById("location").value,
        status:"Open",
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
    document.getElementById("location").value = "";
    document.getElementById("posted").value = "";
    document.getElementById("hrName").value = "";
    if (document.getElementById("expectedTAT")) document.getElementById("expectedTAT").value = "7";

    loadJobs();
}

async function editJob(id) {
    // Convert both to strings for comparison (handles both numeric and string IDs)
    const job = allJobs.find(j => String(j.id) === String(id));
    
    if (!job) {
        alert("Job not found");
        return;
    }
    
    document.getElementById("editId").value = job.id;
    document.getElementById("editDept").value = job.department;
    document.getElementById("editRole").value = job.role;
    document.getElementById("editLevel").value = job.level;
    document.getElementById("editLocation").value = job.location || "";
    document.getElementById("editStatus").value = job.status;
    document.getElementById("editPosted").value = convertToInputFormat(job.posted_date);
    document.getElementById("editOffered").value = convertToInputFormat(job.offered_date);
    document.getElementById("editTAT").value = job.expected_tat;
    document.getElementById("editHRName").value = job.hr_name || "";

    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    modal.show();
}

async function saveEdit() {
    const id = document.getElementById("editId").value;
    const offeredDate = document.getElementById("editOffered").value;
    
    const job = {
        department: document.getElementById("editDept").value,
        role: document.getElementById("editRole").value,
        level: document.getElementById("editLevel").value,
        location: document.getElementById("editLocation").value,
        status: document.getElementById("editStatus").value,
        posted_date: document.getElementById("editPosted").value,
        offered_date: offeredDate || null,
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
    console.log("bulkUpload function called");
    const fileInput = document.getElementById("bulkFile");
    
    if (!fileInput) {
        console.error("File input not found");
        alert("Error: File input not found");
        return;
    }
    
    if (!fileInput.files.length) {
        alert("Please select a CSV or Excel file");
        return;
    }

    console.log("Selected file:", fileInput.files[0].name);
    
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    try {
        console.log("Sending upload request to:", API + "/jobs/bulk");
        const res = await fetch(API + "/jobs/bulk", {
            method: "POST",
            body: formData
        });

        console.log("Response status:", res.status);
        
        if (!res.ok) {
            const errorText = await res.text();
            console.error("Server error:", errorText);
            throw new Error(`Upload failed: ${errorText}`);
        }

        const result = await res.json();
        console.log("Upload result:", result);
        alert(`Uploaded ${result.count} jobs successfully`);
        fileInput.value = "";
        
        // Reload jobs and master data (departments, roles, levels)
        loadJobs();
        loadDepartments();
        loadRoles();
        loadLevels();
    } catch (error) {
        console.error("Upload error:", error);
        alert("Error uploading file: " + error.message);
    }
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
            <button class="btn btn-sm btn-danger" onclick="deleteDepartment('${d.id}')">Delete</button>
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
            <button class="btn btn-sm btn-danger" onclick="deleteRole('${r.id}')">Delete</button>
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
            <button class="btn btn-sm btn-danger" onclick="deleteLevel('${l.id}')">Delete</button>
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

// Authorized Users management
async function loadAuthorizedUsers() {
    const res = await fetch(API + "/authorized-users");
    const users = await res.json();
    
    const list = document.getElementById("usersList");
    list.innerHTML = "";
    
    users.forEach(user => {
        const invitedDate = user.invited_at ? new Date(user.invited_at).toLocaleDateString() : 'N/A';
        const statusBadge = user.status === 'active' 
            ? '<span class="badge bg-success">Active</span>' 
            : '<span class="badge bg-secondary">Inactive</span>';
        
        list.innerHTML += `
        <tr>
            <td>${user.email}</td>
            <td>${user.name || '-'}</td>
            <td>${statusBadge}</td>
            <td>${user.invited_by || '-'}</td>
            <td>${invitedDate}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="removeAuthorizedUser('${user.id}', '${user.email}')">
                    Remove
                </button>
            </td>
        </tr>`;
    });
}

async function addAuthorizedUser() {
    const email = document.getElementById("newUserEmail").value.trim();
    const name = document.getElementById("newUserName").value.trim();
    
    if (!email) {
        alert("Please enter an email address");
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert("Please enter a valid email address");
        return;
    }
    
    try {
        const res = await fetch(API + "/authorized-users", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ email, name })
        });
        
        if (!res.ok) {
            const error = await res.json();
            alert(error.error || "Failed to add user");
            return;
        }
        
        document.getElementById("newUserEmail").value = "";
        document.getElementById("newUserName").value = "";
        loadAuthorizedUsers();
        
        alert(`✅ User ${email} has been authorized to access the dashboard!`);
    } catch (error) {
        console.error("Error adding user:", error);
        alert("Failed to add user. Please try again.");
    }
}

async function removeAuthorizedUser(id, email) {
    if (!confirm(`Are you sure you want to remove access for ${email}?\n\nThey will no longer be able to log in to the dashboard.`)) {
        return;
    }
    
    try {
        const res = await fetch(API + "/authorized-users/" + id, {method: "DELETE"});
        
        if (!res.ok) {
            alert("Failed to remove user");
            return;
        }
        
        loadAuthorizedUsers();
        alert(`User ${email} has been removed.`);
    } catch (error) {
        console.error("Error removing user:", error);
        alert("Failed to remove user. Please try again.");
    }
}

// Initialize - check auth first
(async function() {
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        loadJobs();
        loadDepartments();
        loadRoles();
        loadLevels();
        loadAuthorizedUsers();
        
        // Set current date in header
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDate').textContent = today.toLocaleDateString('en-US', options);
    }
})();