async function initDashboard() {
    try {
        // Fetch both entities simultaneously
        const [actRes, recRes] = await Promise.all([
            fetch('/api/activities'),
            fetch('/api/records')
        ]);

        const activities = await actRes.json();
        const records = await recRes.json();

        // Update Counter 1: Activity Types
        document.getElementById('activity-count').innerText = activities.length;

        // Update Counter 2: Total Emissions (Sum of all records)
        const totalCO2 = records.reduce((sum, record) => sum + record.co2Amount, 0);
        document.getElementById('total-emissions').innerText = `${totalCO2.toFixed(2)} kg`;

        // Render Activity Types Table
        renderActivityTable(activities);
        
        // (Optional) Render Records Table
        // renderRecordsTable(records);

    } catch (err) {
        console.error("Dashboard failed to load:", err);
        // Show user-friendly error (Coursework requirement)
        document.getElementById('total-emissions').innerText = "Offline";
    }
}

function renderActivityTable(activities) {
    const tableBody = document.getElementById('activity-table-body');
    tableBody.innerHTML = activities.map(activity => `
        <tr>
            <td>${activity.name}</td>
            <td>${activity.unit}</td>
            <td>${activity.carbonUnitRate} kg</td>
        </tr>
    `).join('');
}

initDashboard();