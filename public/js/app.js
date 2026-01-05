//---------------------------------------------//
/** ------------ STATE MANAGEMENT ----------- **/
//---------------------------------------------//
let state = {
    activities: [],
    records: [],
    currentView: 'dashboard', // Default to the dashboard view
    editingId: null,
    editingType: null // 'activity' or 'record'
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

        render();
    } catch (err) {
        handleConnectionError(err);
    }
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

// // Render the Dashboard view
// function renderDashboard() {
//     // Dashboard 1
//     document.getElementById('activity-count').innerText = state.activities.length;

//     // Dashboard 2
//     const total = state.records.reduce((sum, r) => sum + r.co2Amount, 0);
//     document.getElementById('total-emissions').innerText = `${total.toFixed(2)} kg`;
// }

let emissionsChart = null; // Global chart instance

function renderDashboard() {
    const range = document.getElementById('timeRangeSelect').value;
    const activityFilter = document.getElementById('graphActivityFilter').value;

    // 1. Calculate Time Windows
    const now = new Date();
    const rangeDays = range === 'today' ? 1 : parseInt(range);
    const msInRange = rangeDays * 24 * 60 * 60 * 1000;

    const currentStart = new Date(now - msInRange);
    const previousStart = new Date(now - (msInRange * 2));

    // 2. Filter Records
    const currentRecords = state.records.filter(r => new Date(r.date) >= currentStart);
    const previousRecords = state.records.filter(r => {
        const d = new Date(r.date);
        return d >= previousStart && d < currentStart;
    });

    // 3. Update Dashboard 1 (Comparison)
    const currentTotal = currentRecords.reduce((sum, r) => sum + r.co2Amount, 0);
    const previousTotal = previousRecords.reduce((sum, r) => sum + r.co2Amount, 0);

    const comparisonDiv = document.getElementById('comparison-stat');
    if (previousTotal > 0) {
        const percent = ((currentTotal - previousTotal) / previousTotal) * 100;
        comparisonDiv.innerText = `${Math.abs(percent).toFixed(1)}%`;
        comparisonDiv.className = percent > 0 ? 'display-4 fw-bold text-danger' : 'display-4 fw-bold text-success';
        document.getElementById('comparison-text').innerText = percent > 0 ? 'Increase from last period' : 'Decrease from last period';
    } else {
        comparisonDiv.innerText = "N/A";
        document.getElementById('comparison-text').innerText = "Not enough data for comparison";
    }

    // 4. Update Dashboard 2 (Ranking)
    document.getElementById('dashboard-total').innerText = `${currentTotal.toFixed(2)} kg CO2`;
    const rankingDiv = document.getElementById('category-ranking');
    const grouped = currentRecords.reduce((acc, r) => {
        acc[r.activityName] = (acc[r.activityName] || 0) + r.co2Amount;
        return acc;
    }, {});

    rankingDiv.innerHTML = Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
        .map(([name, val], i) => `<div>${i + 1}. ${name}: ${((val / currentTotal) * 100).toFixed(1)}%</div>`)
        .join('');

    // 5. Update Line Graph
    updateGraph(currentRecords, range, activityFilter);
}

function updateGraph(records, range, filter) {
    const ctx = document.getElementById('emissionsChart').getContext('2d');

    // Apply Activity Filter
    const filtered = filter === 'all' ? records : records.filter(r => r.activityId === filter);

    // Sort by date for the graph
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    const labels = filtered.map(r => r.date);
    const data = filtered.map(r => r.co2Amount);

    if (emissionsChart) emissionsChart.destroy();

    emissionsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'CO2 Emissions (kg)',
                data: data,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                fill: true,
                tension: 0.4, // Smooth line like in your reference image
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

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



//---------------------------------------------//
/** ---------- CRUD & MODAL lOGIC ----------- **/
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