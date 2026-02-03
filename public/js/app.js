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
    activitySort: { column: 'name', direction: 'asc' },
    dailyCarbonGoal: 15.0,
    heatmapYear: new Date().getFullYear(),
    theme: localStorage.getItem('theme') || 'light'
};

// Apply theme immediately
if (state.theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
}

// Global function for the toggle switch
window.toggleTheme = function (isDark) {
    state.theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('theme', state.theme);

    // access checkbox to ensure it stays in sync if toggled programmatically
    const checkbox = document.getElementById('checkbox');
    if (checkbox) checkbox.checked = isDark;

    render(); // Re-render to update charts
};

// Initialize Checkbox state on load
document.addEventListener('DOMContentLoaded', () => {
    const checkbox = document.getElementById('checkbox');
    if (checkbox) {
        checkbox.checked = state.theme === 'dark';
    }
});

const modal = new bootstrap.Modal(document.getElementById('crudModal'));
const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));

async function syncAppData() {
    try {
        const [activities, records, settings] = await Promise.all([
            fetch('/api/activities'),
            fetch('/api/records?extend=activityType'),
            fetch('/api/settings')
        ]);

        if (!activities.ok || !records.ok || !settings.ok) throw new Error("Server error");

        state.activities = await activities.json();
        state.records = await records.json();
        state.settings = await settings.json();
        state.dailyCarbonGoal = state.settings.dailyCarbonGoal;

        const goalInput = document.getElementById('dailyCarbonGoalInput');
        if (goalInput && document.activeElement !== goalInput) {
            goalInput.value = state.dailyCarbonGoal;
        }

        populateActivityDropdowns();
        render();
        handleConnectionError(null); // Clear any previous error message
    }
    catch (err) {
        handleConnectionError(err);
    }
}

// Populate the Activity Type dropdowns (Emissions Graph & Record Filter)
function populateActivityDropdowns() {
    const graphSelect = document.getElementById('graphActivityFilter');
    const recordSelect = document.getElementById('recordFilter');

    // Helper to populate a select element
    const populate = (select, defaultText, defaultValue) => {
        if (!select) return;
        // Keep selected value if re-populating
        const currentVal = select.value;
        select.innerHTML = `<option value="${defaultValue}">${defaultText}</option>`;

        // Filter out hidden activities (unless it's the currently selected one, to avoid breaking edits)
        // Sort: Favorites first, then alphabetical
        const sortedActivities = [...state.activities]
            .filter(a => !a.hideInDropdown)
            .sort((a, b) => {
                // Primary sort: Favorites (true comes before false)
                if ((a.isFavorite || false) !== (b.isFavorite || false)) {
                    return (b.isFavorite || false) - (a.isFavorite || false);
                }
                // Secondary sort: Name alphabetical
                return a.name.localeCompare(b.name);
            });

        sortedActivities.forEach(activity => {
            const option = document.createElement('option');
            option.value = activity.id;
            // Add star icon for favorites
            option.innerText = (activity.isFavorite ? '⭐ ' : '') + activity.name;
            select.appendChild(option);
        });

        if (currentVal) select.value = currentVal;
    };

    populate(graphSelect, 'All Activities', 'all');
    populate(recordSelect, 'All Records', '');
}

// Get daily carbon emission totals
function getDailyCarbonTotals(records) {
    if (!Array.isArray(records)) return {};
    return records.reduce((dailyTotals, record) => {
        if (!record.date) return dailyTotals;

        const dateStr = record.date.split('T')[0];
        dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + record.co2Amount;
        return dailyTotals;
    }, {});
}

// Update the daily carbon goal from the Carbon Heatmap dashboard panel
async function updateDailyCarbonGoal() {
    const val = parseFloat(document.getElementById('dailyCarbonGoalInput').value);
    if (isNaN(val)) return;

    try {
        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dailyCarbonGoal: val })
        });
        if (response.ok) {
            state.dailyCarbonGoal = val;
            render();
            showToast("Daily goal updated.");
        }
    }
    catch (error) {
        console.error("Failed to update daily carbon goal:", error);
        showToast("Failed to save goal.");
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

    // Filter out records from excluded activity types
    const validRecords = state.records.filter(record => {
        if (!record.activityType) return true; // Keep if unknown, or handle as you wish
        return !record.activityType.excludeFromDashboard;
    });

    const currentRecords = validRecords.filter(record => {
        const d = new Date(record.date);
        return d >= currentStart && d <= now;
    });

    const previousRecords = validRecords.filter(record => {
        const d = new Date(record.date);
        return d >= previousStart && d < currentStart;
    });

    const currentTotal = currentRecords.reduce((sum, record) => sum + record.co2Amount, 0);
    const previousTotal = previousRecords.reduce((sum, record) => sum + record.co2Amount, 0);

    // Render the actual dashboards
    renderComparison(currentTotal, previousTotal);
    renderEmissionsBreakdown(currentRecords, currentTotal);
    renderEmissionsGraph(currentRecords, currentStart, now, activityFilter);
    renderYearlyHeatmap(); // Heatmap uses state.records directly, need to check that too
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
    const grouped = records.reduce((categoryBreakdown, record) => {
        const name = record.activityType ? record.activityType.name : "Other";
        categoryBreakdown[name] = (categoryBreakdown[name] || 0) + record.co2Amount;
        return categoryBreakdown;
    }, {});

    // Sort the Activity Types and display the top 5
    rankingDiv.innerHTML = Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, carbonValue]) => {
            const pct = total > 0 ? ((carbonValue / total) * 100).toFixed(1) : 0;
            return `
                <div class="mb-3">
                    <div class="d-flex justify-content-between small mb-1">
                        <span style="color: var(--text-primary)">${name}</span>
                        <span class="fw-bold" style="color: var(--text-primary)">${pct}%</span>
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
        : records.filter(record => String(record.activityId) === String(filter));

    // Create the chart
    const dailyTotals = getDailyCarbonTotals(filtered);
    const dataPoints = Object.entries(dailyTotals).map(([dateStr, total]) => ({
        x: new Date(dateStr),
        y: total
    })).sort((a, b) => a.x - b.x);

    new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'kg CO2',
                data: dataPoints,
                borderColor: getThemeColor('accent-color'),
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
                    title: { display: true, text: 'Date', color: getThemeColor('text-secondary') },
                    grid: { color: getThemeColor('divider-color') },
                    ticks: { color: getThemeColor('text-secondary') }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'kg CO2', color: getThemeColor('text-secondary') },
                    grid: { color: getThemeColor('divider-color') },
                    ticks: { color: getThemeColor('text-secondary') }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// Re-rendered the Yearly Heatmap dashboard panel when the user changes the year
function changeHeatmapYear(difference) {
    state.heatmapYear += difference;
    renderYearlyHeatmap();
}

// Render the Yearly Heatmap dashboard panel
function renderYearlyHeatmap() {
    const container = document.getElementById('carbonHeatmap');
    const yearDisplay = document.getElementById('heatmapYearDisplay');
    const tooltip = document.getElementById('heatmap-tooltip');
    if (!container || !yearDisplay) return;

    const year = state.heatmapYear;
    yearDisplay.textContent = year;

    // Get daily data for the selected year
    // Get daily data for the selected year (Filter excluded activities)
    const validRecords = state.records.filter(record => {
        if (!record.activityType) return true;
        return !record.activityType.excludeFromDashboard;
    });
    const allDailyData = getDailyCarbonTotals(validRecords);

    const dailyDataForYear = {};
    Object.entries(allDailyData).forEach(([dateStr, total]) => {
        if (new Date(dateStr).getFullYear() === year) {
            dailyDataForYear[dateStr] = total;
        }
    });

    container.innerHTML = '';

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    for (let month = 0; month < 12; month++) {
        // The day of the week the month starts on
        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        const firstDayMon = firstDay === 0 ? 6 : firstDay - 1; // now 0=Mon
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Create the block for that month
        const mBlock = document.createElement('div');
        mBlock.className = 'month-block';

        const mHeader = document.createElement('div');
        mHeader.className = 'month-header';
        const mLabel = document.createElement('div');
        mLabel.className = 'month-label';
        mLabel.textContent = monthNames[month];
        mHeader.appendChild(mLabel);
        mBlock.appendChild(mHeader);

        const mGrid = document.createElement('div');
        mGrid.className = 'month-grid';

        // Add day labels to the left of the month's heatmap
        const dCol = document.createElement('div');
        dCol.className = 'days-column';
        const labels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
        labels.forEach(l => {
            const lbl = document.createElement('div');
            lbl.className = 'day-label';
            lbl.textContent = l;
            dCol.appendChild(lbl);
        });
        mGrid.appendChild(dCol);

        // Break the month into weeks, using the firstDayMon as a refernce for the starting day
        const weeksGrid = document.createElement('div');
        weeksGrid.className = 'weeks-grid';

        let dayCounter = 1;
        const totalCells = firstDayMon + daysInMonth;
        const weeksNeeded = Math.ceil(totalCells / 7);

        for (let w = 0; w < weeksNeeded; w++) {
            const wCol = document.createElement('div');
            wCol.className = 'week-column';

            for (let d = 0; d < 7; d++) {
                const cell = document.createElement('div');
                cell.className = 'day-cell';

                const cellIdx = w * 7 + d;
                if (cellIdx < firstDayMon || dayCounter > daysInMonth) {
                    cell.classList.add('no-data'); // Use no-data class for hidden/padding cells
                } else {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayCounter).padStart(2, '0')}`;
                    const cellDate = new Date(year, month, dayCounter);
                    const isFuture = cellDate > new Date();

                    if (isFuture) {
                        // Future cells are just empty/disabled style
                        cell.style.backgroundColor = 'var(--heatmap-empty)';
                        cell.style.opacity = '0.5';
                        cell.style.cursor = 'default';
                    } else {
                        const val = dailyDataForYear[dateStr] || 0;
                        const level = getHeatmapColorLevel(val, state.dailyCarbonGoal);
                        cell.classList.add(`level-${level}`);

                        // Tooltip when hovering over a day
                        cell.onmouseenter = (e) => {
                            tooltip.innerHTML = `
                                <strong>${cellDate.toLocaleDateString(undefined, { dateStyle: 'medium' })}</strong><br/>
                                 <span class="${val <= state.dailyCarbonGoal ? 'text-success' : 'text-danger'}">
                                    ${val.toFixed(2)} kg CO2
                                </span><br/>
                                <small>${val <= state.dailyCarbonGoal ? 'Goal Met' : 'Over Goal'}</small>
                            `;
                            tooltip.style.opacity = '1';
                        };
                        cell.onmousemove = (e) => {
                            tooltip.style.left = (e.clientX + 10) + 'px';
                            tooltip.style.top = (e.clientY - 40) + 'px';
                        };
                        cell.onmouseleave = () => tooltip.style.opacity = '0';
                    }
                    dayCounter++;
                }
                wCol.appendChild(cell);
            }
            weeksGrid.appendChild(wCol);
        }

        mGrid.appendChild(weeksGrid);
        mBlock.appendChild(mGrid);
        container.appendChild(mBlock);
    }

    // Update that years stats at the bottom
    updateHeatmapStats(dailyDataForYear, year);
}

// Traffic light coding for the boxes in the Yearly Heatmap dashboard panel
function getHeatmapColorLevel(emission, goal) {
    const ratio = emission / goal;

    // GOOD (Green)
    if (ratio <= 0.2) return 12;
    if (ratio <= 0.4) return 11;
    if (ratio <= 0.6) return 10;
    if (ratio <= 0.8) return 9;
    if (ratio <= 1.0) return 8;

    // WARNING (Amber)
    if (ratio <= 1.15) return 7;
    if (ratio <= 1.35) return 6;
    if (ratio <= 1.55) return 5;

    // BAD (Red)
    if (ratio <= 1.8) return 4;
    if (ratio <= 2.2) return 3;
    if (ratio <= 2.6) return 2;
    if (ratio <= 3.0) return 1;
    return 0;
}

// Update the stats at the bottom of the Yearly Heatmap dashboard panel
function updateHeatmapStats(data, year) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const isCurrentYear = now.getFullYear() === year;
    const endCondition = isCurrentYear ? now : new Date(year, 11, 31);

    let totalEmissionsSum = 0;
    let daysMetCount = 0;
    let totalDaysCount = 0;

    const current = new Date(year, 0, 1);
    current.setHours(0, 0, 0, 0);

    while (current <= endCondition) {
        const dateStr = current.getFullYear() + '-' +
            String(current.getMonth() + 1).padStart(2, '0') + '-' +
            String(current.getDate()).padStart(2, '0');

        const emission = data[dateStr] || 0;

        totalEmissionsSum += emission;
        if (emission <= state.dailyCarbonGoal) {
            daysMetCount++;
        }
        totalDaysCount++;

        current.setDate(current.getDate() + 1);
    }

    if (totalDaysCount === 0) {
        document.getElementById('heatmapStatAvg').textContent = '0 kg';
        document.getElementById('heatmapStatFrequency').textContent = '0%';
        document.getElementById('heatmapStatTotal').textContent = '0 kg';
        return;
    }

    const avg = totalEmissionsSum / totalDaysCount;
    const frequency = (daysMetCount / totalDaysCount) * 100;

    document.getElementById('heatmapStatAvg').textContent = `${avg.toFixed(1)} kg`;
    document.getElementById('heatmapStatFrequency').textContent = `${Math.round(frequency)}%`;
    document.getElementById('heatmapStatTotal').textContent = `${totalEmissionsSum.toFixed(1)} kg`;
}

/** -- ACTIVITIES -- **/
// Render the Activities view
function renderActivities() {
    const tableBody = document.getElementById('activity-table-body');
    if (!tableBody) return;

    // If no activities are found
    if (state.activities.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No activities found matching your search</td></tr>';
        return;
    }

    tableBody.innerHTML = state.activities.map(activity => `
        <tr>
            <td>
                ${activity.isFavorite ? '<span class="be-1" title="Favorite">⭐</span>' : ''}
                ${activity.name}
                ${activity.excludeFromDashboard ? '<span class="badge bg-secondary ms-1" style="font-size: 0.6em">No-Dash</span>' : ''}
                ${activity.hideInDropdown ? '<span class="badge bg-dark ms-1" style="font-size: 0.6em">Hidden</span>' : ''}
            </td>
            <td>${activity.unit}</td>
            <td>${activity.carbonUnitRate} kg</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="openModal('activity', '${activity.id}')">Edit</button>
                <button class="btn btn-sm btn-outline-secondary" onclick="copyItem('activity', '${activity.id}')">Copy</button>
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

// Search Activities
let activitySearchTimeout;
function searchActivities() {
    clearTimeout(activitySearchTimeout);
    const query = document.getElementById('activitySearch').value;

    // Debounce to prevent slamming the server
    activitySearchTimeout = setTimeout(async () => {
        try {
            const url = query ? `/api/activities?name=${encodeURIComponent(query)}` : '/api/activities';
            const response = await fetch(url);
            if (response.ok) {
                state.activities = await response.json();
                renderActivities();
            }
        }
        catch (error) {
            console.error("Search failed", error);
            showToast("Failed to search activities");
        }
    }, 300);
}

/** -- RECORDS -- **/
// Render the Records view
function renderRecords() {
    const tableBody = document.getElementById('record-table-body');
    if (!tableBody) return;

    // If no records are found
    if (state.records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No records found matching your filters</td></tr>';
        return;
    }

    tableBody.innerHTML = state.records.map(record => {
        const categoryName = record.activityType ? record.activityType.name : 'Unknown';

        return `
            <tr>
                <td><span class="badge bg-secondary">${categoryName}</span></td>
                <td>${record.activityName}</td> 
                <td>${record.amount}</td>
                <td>${record.co2Amount} kg</td>
                <td>${record.date}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="openModal('record', '${record.id}')">Edit</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="copyItem('record', '${record.id}')">Copy</button>
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
            valueA = recordA.activityType ? recordA.activityType.name.toLowerCase() : '';
            valueB = recordB.activityType ? recordB.activityType.name.toLowerCase() : '';
        } else if (key === 'date') {
            valueA = new Date(recordA[key]).getTime();
            valueB = new Date(recordB[key]).getTime();
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

// Filter & Search Records
let recordSearchTimeout;
function searchRecords() {
    clearTimeout(recordSearchTimeout);

    // Debounce to prevent slamming the server
    recordSearchTimeout = setTimeout(async () => {
        const activityId = document.getElementById('recordFilter').value;
        const searchQuery = document.getElementById('recordSearch').value;

        try {
            const params = new URLSearchParams();
            if (activityId) params.append('activityId', activityId);
            if (searchQuery) params.append('name', searchQuery);

            const url = `/api/records?${params.toString()}&extend=activityType`;
            const response = await fetch(url);
            if (response.ok) {
                state.records = await response.json();
                renderRecords();
            }
        }
        catch (error) {
            console.error("Search failed", error);
            showToast("Failed to search records");
        }
    }, 300);
}



//---------------------------------------------//
/** ----------- CRUD & MODAL LOGIC ---------- **/
//---------------------------------------------//

// The Edit and Create events for Activities and Records
function openModal(type, id = null, prefillData = null) {
    state.editingType = type;
    state.editingId = id;

    // Set title: pass id implies Edit, otherwise Add (possibly with copy data)
    document.getElementById('modalTitle').innerText = id ? `Edit ${type}` : `Add ${type}`;
    const deleteBtn = document.getElementById('btnDelete');
    id ? deleteBtn.classList.remove('d-none') : deleteBtn.classList.add('d-none');

    const body = document.getElementById('modalBody');
    if (type === 'activity') {
        let activity;
        if (id) {
            activity = state.activities.find(a => String(a.id) === String(id));
        } else if (prefillData) {
            activity = prefillData;
        } else {
            activity = { name: '', unit: '', carbonUnitRate: '', excludeFromDashboard: false, isFavorite: false, hideInDropdown: false };
        }

        body.innerHTML = `
            <input type="text" id="f-name" class="form-control mb-2" placeholder="Name" value="${activity.name}">
            <input type="text" id="f-unit" class="form-control mb-2" placeholder="Unit" value="${activity.unit}">
            <input type="number" id="f-rate" class="form-control mb-2" placeholder="Rate" value="${activity.carbonUnitRate}">
            
            <div class="d-flex flex-column gap-2 mt-3">
                 <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="f-fav" 
                        onchange="document.getElementById('f-hide').checked = this.checked ? false : document.getElementById('f-hide').checked"
                        ${activity.isFavorite ? 'checked' : ''}>
                    <label class="form-check-label" for="f-fav">⭐ Favorite (Prioritize in lists)</label>
                </div>

                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="f-hide" 
                        onchange="document.getElementById('f-fav').checked = this.checked ? false : document.getElementById('f-fav').checked"
                        ${activity.hideInDropdown ? 'checked' : ''}>
                    <label class="form-check-label" for="f-hide">🚫 Hide from Dropdowns</label>
                </div>

                <div class="form-check border-top pt-2">
                    <input class="form-check-input" type="checkbox" id="f-exclude" ${activity.excludeFromDashboard ? 'checked' : ''}>
                    <label class="form-check-label" for="f-exclude">Exclude from Dashboard Stats</label>
                </div>
            </div>
        `;
    }
    else {
        let record;
        if (id) {
            record = state.records.find(r => String(r.id) === String(id));
        } else if (prefillData) {
            record = prefillData;
        } else {
            record = { activityId: '', activityName: '', amount: '', date: new Date().toISOString().split('T')[0] };
        }

        // Sort activities for record creation too: Favorites first, then alphabetical, excluding hidden ones
        const sortedForModal = [...state.activities]
            .filter(a => !a.hideInDropdown || a.id === record.activityId) // Include hidden if it's the current value
            .sort((a, b) => {
                if ((a.isFavorite || false) !== (b.isFavorite || false)) {
                    return (b.isFavorite || false) - (a.isFavorite || false);
                }
                return a.name.localeCompare(b.name);
            });

        const options = sortedForModal.map(activity =>
            `<option value="${activity.id}" ${activity.id === record.activityId ? 'selected' : ''}>${activity.isFavorite ? '⭐ ' : ''}${activity.name}</option>`
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

// Copy Item Event
function copyItem(type, id) {
    const list = type === 'activity' ? state.activities : state.records;
    const item = list.find(i => String(i.id) === String(id));
    if (item) {
        // Pass item as prefill data, but id as null so it is treated as new
        openModal(type, null, { ...item }); // Spread to create a shallow copy
    }
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
            carbonUnitRate: parseFloat(document.getElementById('f-rate').value),
            excludeFromDashboard: document.getElementById('f-exclude').checked,
            isFavorite: document.getElementById('f-fav').checked,
            hideInDropdown: document.getElementById('f-hide').checked
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

    const saveBtn = document.getElementById('btnSave');
    const originalText = saveBtn.innerText;
    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    try {
        const response = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            modal.hide();
            syncAppData();
            showToast("Changes saved successfully.");
        } else {
            const data = await response.json();
            showToast(`Error: ${data.error || "Failed to save"}`);
        }
    } catch (error) {
        console.error(error);
        showToast("Network error. Please try again.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = originalText;
    }
}

// Delete event for Activities and Records
function handleDelete() {
    deleteModal.show();
}

// Confirmed Delete
async function confirmDelete() {
    const type = state.editingType === 'activity' ? 'activities' : 'records';
    const deleteBtn = document.getElementById('btnConfirmDelete');
    const originalText = deleteBtn.innerText;

    deleteBtn.disabled = true;
    deleteBtn.innerText = "Deleting...";

    try {
        const response = await fetch(`/api/${type}/${state.editingId}`, { method: 'DELETE' });
        if (response.ok) {
            deleteModal.hide();
            modal.hide();
            syncAppData();
            showToast("Item deleted successfully.");
        } else {
            showToast("Failed to delete item.");
        }
    }
    catch (error) {
        console.error(error);
        showToast("Network error. Please try again.");
    }
    finally {
        deleteBtn.disabled = false;
        deleteBtn.innerText = originalText;
    }
}


// Show connection error message when server is offline
function handleConnectionError(err = null) {
    const alert = document.getElementById('offline-alert');

    if (err) {
        console.error("API Connection Error:", err);
        alert.classList.remove('d-none');
        document.body.style.paddingTop = alert.offsetHeight + 'px';
    } else {
        alert.classList.add('d-none');
        document.body.style.paddingTop = '0';
    }
}

// Show a toast notification
function showToast(message) {
    const toastEl = document.getElementById('liveToast');
    const toastMsg = document.getElementById('toastMessage');
    if (toastEl && toastMsg) {
        toastMsg.textContent = message;
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }
}

// Start the app
syncAppData();

// Helper to get CSS variable values for Chart.js
function getThemeColor(variableName) {
    return getComputedStyle(document.documentElement).getPropertyValue(`--${variableName}`).trim();
}