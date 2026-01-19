//---------------------------------------------//
/** -------- STATE & DATA MANAGEMENT -------- **/
//---------------------------------------------//
let state = {
    activities: [],
    records: [],
    currentView: 'dashboard', // Default to the dashboard view
    editingId: null,
    editingType: null, // 'activity' or 'record'
    recordSort: { column: 'date', direction: 'desc' },
    activitySort: { column: 'name', direction: 'asc' }
};

const modal = new bootstrap.Modal(document.getElementById('crudModal'));

async function syncAppData() {
    try {
        const [actRes, recRes] = await Promise.all([
            fetch('/api/activities'),
            fetch('/api/records')
        ]);

        if (!actRes.ok || !recRes.ok) throw new Error("Server error");

        state.activities = await actRes.json();
        state.records = await recRes.json();

        populateGraphDropdown();
        render();
    } catch (err) {
        handleConnectionError(err);
    }
}

// Populate the Activity Type dropdown for the Emissions Graph dashboard panel
function populateGraphDropdown() {
    const select = document.getElementById('graphActivityFilter');
    if (!select) return;

    select.innerHTML = '<option value="all">All Activities</option>'; // Default to all
    state.activities.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.innerText = a.name;
        select.appendChild(opt);
    });
}



//---------------------------------------------//
/** ------------ VIEW MANAGEMENT ------------ **/
//---------------------------------------------//
function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('d-none'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));

    document.getElementById(`view-${viewName}`).classList.remove('d-none');
    document.getElementById(`nav-${viewName}`).classList.add('active');
    state.currentView = viewName;

    syncAppData();
}



//---------------------------------------------//
/** --------------- RENDERING --------------- **/
//---------------------------------------------//
function render() {
    renderDashboard();
    renderActivities();
    renderRecords();
}

/** -- DASHBOARDS -- **/
let emissionsChart = null;

// Render the Dashboard view
function renderDashboard() {

    // Get data between the selected timeframe option and the present date
    const range = document.getElementById('timeRangeSelect').value;
    const activityFilter = document.getElementById('graphActivityFilter').value;

    const now = new Date();
    const rangeDays = range === 'today' ? 0 : parseInt(range);
    const currentStart = new Date();
    currentStart.setDate(now.getDate() - rangeDays);
    currentStart.setHours(0, 0, 0, 0);

    const previousStart = new Date();
    previousStart.setDate(currentStart.getDate() - (rangeDays || 1) - rangeDays);
    previousStart.setHours(0, 0, 0, 0);

    const currentRecords = state.records.filter(r => {
        const d = new Date(r.date);
        return d >= currentStart && d <= now;
    });

    const previousRecords = state.records.filter(r => {
        const d = new Date(r.date);
        return d >= previousStart && d < currentStart;
    });

    const currentTotal = currentRecords.reduce((sum, r) => sum + r.co2Amount, 0);
    const previousTotal = previousRecords.reduce((sum, r) => sum + r.co2Amount, 0);

    // Render the actual dashboards
    renderComparison(currentTotal, previousTotal);
    renderEmissionsBreakdown(currentRecords, currentTotal);
    renderEmissionsGraph(currentRecords, currentStart, now, activityFilter);
}

// Render the Time Range Comparison dashboard panel
function renderComparison(current, previous) {
    const statDiv = document.getElementById('comparison-stat');
    const textDiv = document.getElementById('comparison-text');

    // If there is no data for this period or the previous one
    if (current === 0 && previous === 0) {
        statDiv.innerText = "---";
        statDiv.className = "display-4 fw-bold text-muted";
        textDiv.innerText = "No records found for this period.";
        return;
    }

    // If there is data for this period but there is none for the previous one
    if (previous <= 0) {
        statDiv.innerText = "---";
        statDiv.className = "display-4 fw-bold text-secondary";
        textDiv.innerText = "There is no data for the previous equal time period.";
        return;
    }

    // If we have data for this period and the previous one
    const percent = ((current - previous) / previous) * 100;
    const isIncrease = percent > 0;

    statDiv.innerText = `${Math.abs(percent).toFixed(1)}%`;

    // Show the percentage as red it is an increase and green if is a decrease and compare to previous period
    statDiv.className = isIncrease ? "display-4 fw-bold text-danger" : "display-4 fw-bold text-success";
    const direction = isIncrease ? "higher" : "lower";
    textDiv.innerHTML = `
        ${direction} than previous period
        <div class="mt-1 small text-muted">
            Previous total: <strong>${previous.toFixed(2)} kg</strong>
        </div>
    `;
}

// Render the Emissions Breakdown dashboard panel
function renderEmissionsBreakdown(records, total) {
    const rankingDiv = document.getElementById('category-ranking');
    document.getElementById('dashboard-total').innerText = `${total.toFixed(2)} kg CO2`;

    // Group records by their Activity Type 
    const grouped = records.reduce((acc, r) => {
        const category = state.activities.find(a => String(a.id) === String(r.activityId));
        const name = category ? category.name : "Other";
        acc[name] = (acc[name] || 0) + r.co2Amount;
        return acc;
    }, {});

    // Sort the Activity Types and display the top 5
    rankingDiv.innerHTML = Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, val]) => {
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
            return `
                <div class="mb-3">
                    <div class="d-flex justify-content-between small mb-1">
                        <span>${name}</span>
                        <span class="fw-bold">${pct}%</span>
                    </div>
                    <div class="progress" style="height: 10px; border-radius: 5px;">
                        <div class="progress-bar bg-primary" role="progressbar" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        }).join('');
}

// Render the Emissions Graph dashboard panel
function renderEmissionsGraph(records, minDate, maxDate, filter) {
    const canvas = document.getElementById('emissionsChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy any existing emissionsChart instances to prevent "Canvas already in use" error
    const existingChart = Chart.getChart("emissionsChart");
    if (existingChart) {
        existingChart.destroy();
    }

    // Filter the data based on the Activity Type dropdown option selected
    const filtered = filter === 'all'
        ? records
        : records.filter(r => String(r.activityId) === String(filter));

    // Create the chart
    const dataPoints = filtered.map(r => ({
        x: new Date(r.date),
        y: r.co2Amount
    })).sort((a, b) => a.x - b.x);

    new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'kg CO2',
                data: dataPoints,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: { day: 'MMM d' }
                    },
                    min: minDate.toISOString(),
                    max: maxDate.toISOString(),
                    title: { display: true, text: 'Date' }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'kg CO2' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

/** -- ACTIVITIES -- **/
// Render the Activities view
function renderActivities() {
    const tableBody = document.getElementById('activity-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = state.activities.map(a => `
        <tr>
            <td>${a.name}</td>
            <td>${a.unit}</td>
            <td>${a.carbonUnitRate} kg</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="openModal('activity', '${a.id}')">Edit</button>
            </td>
        </tr>
    `).join('');
}

// Sort the Activities table
function sortActivities(key) {
    // Toggle direction if clicking the same column again
    if (state.activitySort.column === key) {
        state.activitySort.direction = state.activitySort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        state.activitySort.column = key;
        state.activitySort.direction = 'asc';
    }

    // Sort the activities in the selected direction
    state.activities.sort((activityA, activityB) => {
        let valueA = activityA[key];
        let valueB = activityB[key];

        if (typeof valueA === 'string') {
            valueA = valueA.toLowerCase();
            valueB = valueB.toLowerCase();
        }

        if (valueA < valueB) return state.activitySort.direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return state.activitySort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    renderActivities();
}

/** -- RECORDS -- **/
// Render the Records view
function renderRecords() {
    const tableBody = document.getElementById('record-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = state.records.map(r => {
        const activityCategory = state.activities.find(a => String(a.id) === String(r.activityId));
        const categoryName = activityCategory ? activityCategory.name : 'Unknown';

        return `
            <tr>
                <td><span class="badge bg-secondary">${categoryName}</span></td>
                <td>${r.activityName}</td> 
                <td>${r.amount}</td>
                <td>${r.co2Amount} kg</td>
                <td>${r.date}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="openModal('record', '${r.id}')">Edit</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Sort the Records table
function sortRecords(key) {
    // Toggle direction if clicking the same column again
    if (state.recordSort.column === key) {
        state.recordSort.direction = state.recordSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        state.recordSort.column = key;
        state.recordSort.direction = 'asc';
    }

    // Sort the records in the selected direction
    state.records.sort((recordA, recordB) => {
        let valueA, valueB;

        if (key === 'activityType') {
            const categoryA = state.activities.find(act => String(act.id) === String(recordA.activityId));
            const categoryB = state.activities.find(act => String(act.id) === String(recordB.activityId));
            valueA = categoryA ? categoryA.name.toLowerCase() : '';
            valueB = categoryB ? categoryB.name.toLowerCase() : '';
        } else if (typeof recordA[key] === 'string') {
            valueA = recordA[key].toLowerCase();
            valueB = recordB[key].toLowerCase();
        } else {
            valueA = recordA[key];
            valueB = recordB[key];
        }

        if (valueA < valueB) return state.recordSort.direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return state.recordSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    renderRecords();
}



//---------------------------------------------//
/** ----------- CRUD & MODAL LOGIC ---------- **/
//---------------------------------------------//

// The Edit and Create events for Activities and Records
function openModal(type, id = null) {
    state.editingType = type;
    state.editingId = id;

    document.getElementById('modalTitle').innerText = id ? `Edit ${type}` : `Add ${type}`;
    const deleteBtn = document.getElementById('btnDelete');
    id ? deleteBtn.classList.remove('d-none') : deleteBtn.classList.add('d-none');

    const body = document.getElementById('modalBody');
    if (type === 'activity') {
        const activity = id ? state.activities.find(a => String(a.id) === String(id)) : { name: '', unit: '', carbonUnitRate: '' };
        body.innerHTML = `
            <input type="text" id="f-name" class="form-control mb-2" placeholder="Name" value="${activity.name}">
            <input type="text" id="f-unit" class="form-control mb-2" placeholder="Unit" value="${activity.unit}">
            <input type="number" id="f-rate" class="form-control mb-2" placeholder="Rate" value="${activity.carbonUnitRate}">
        `;
    }
    else {
        const record = id ? state.records.find(r => String(r.id) === String(id)) : { activityId: '', activityName: '', amount: '', date: new Date().toISOString().split('T')[0] };

        const options = state.activities.map(a =>
            `<option value="${a.id}" ${a.id === record.activityId ? 'selected' : ''}>${a.name}</option>`
        ).join('');

        body.innerHTML = `
            <select id="f-actId" class="form-select mb-2">${options}</select>
            <input type="text" id="f-actName" class="form-control mb-2" placeholder="Name" value="${record.activityName}">
            <input type="number" id="f-amount" class="form-control mb-2" placeholder="Amount" value="${record.amount}">
            <input type="date" id="f-date" class="form-control mb-2" placeholder="Date" value="${record.date}">
        `;
    }
    modal.show();
}

// Save event for Activities and Records
async function handleSave() {
    const type = state.editingType;
    const isEdit = !!state.editingId;
    const url = `/api/${type === 'activity' ? 'activities' : 'records'}${isEdit ? `/${state.editingId}` : ''}`;

    let payload = {};
    if (type === 'activity') {
        payload = {
            name: document.getElementById('f-name').value,
            unit: document.getElementById('f-unit').value,
            carbonUnitRate: parseFloat(document.getElementById('f-rate').value)
        };
    }
    else {
        payload = {
            activityId: document.getElementById('f-actId').value,
            activityName: document.getElementById('f-actName').value,
            amount: parseFloat(document.getElementById('f-amount').value),
            date: document.getElementById('f-date').value
        };
    }

    const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        modal.hide();
        syncAppData();
    }
}

// Deletion event for Activities and Records
async function handleDelete() {
    if (!confirm("Are you sure? This will delete the entry forever.")) return;
    const type = state.editingType === 'activity' ? 'activities' : 'records';
    const res = await fetch(`/api/${type}/${state.editingId}`, { method: 'DELETE' });
    if (res.ok) {
        modal.hide();
        syncAppData();
    }
}

function handleConnectionError(err) {
    console.error("API Connection Error:", err);
    const statusLabel = document.getElementById('total-emissions');
    if (statusLabel) statusLabel.innerHTML = '<span class="text-danger">Offline</span>';
}



// Start the app
syncAppData();