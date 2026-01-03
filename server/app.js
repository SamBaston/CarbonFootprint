const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public')); // Serve frontend files

const ACTIVITIES_FILE = path.join(__dirname, '../data/activities.json');
const RECORDS_FILE = path.join(__dirname, '../data/records.json');

// Read to JSON files
async function readData(filePath) {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
}

// Write to JSON files
async function writeData(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}



/** --- ACTIVITY TYPE ENDPOINTS --- **/

// GET all activity types
app.get('/api/activities', async (req, res) => {
    try {
        const activities = await readData(ACTIVITIES_FILE);
        res.json(activities);
    } catch (err) {
        res.status(500).json({ error: "Failed to read activities" });
    }
});

// POST new activity type
app.post('/api/activities', async (req, res) => {
    const { id, name, unit, carbonUnitRate } = req.body;
    if (!id || !name || !carbonUnitRate) return res.status(400).json({ error: "Missing fields" });

    const activities = await readData(ACTIVITIES_FILE);
    activities.push({ id, name, unit, carbonUnitRate });
    await writeData(ACTIVITIES_FILE, activities);
    res.status(201).json({ message: "Activity added" });
});

// PUT (update) activity type
app.put('/api/activities/:id', async (req, res) => {
    const activities = await readData(ACTIVITIES_FILE);
    const index = activities.findIndex(a => a.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Not found" });

    activities[index] = { ...activities[index], ...req.body };
    await writeData(ACTIVITIES_FILE, activities);
    res.json(activities[index]);
});

// DELETE activity type
app.delete('/api/activities/:id', async (req, res) => {
    let activities = await readData(ACTIVITIES_FILE);
    activities = activities.filter(a => a.id !== req.params.id);
    await writeData(ACTIVITIES_FILE, activities);
    res.status(204).send();
});



/** --- RECORDS ENDPOINTS --- **/

// GET all records
app.get('/api/records', async (req, res) => {
    try {
        const records = await readData(RECORDS_FILE);
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: "Failed to read records" });
    }
});

// GET a specific record
app.get('/api/records/:id', async (req, res) => {
    try {
        const records = await readData(RECORDS_FILE);
        const targetId = String(req.params.id).trim();
        const record = records.find(r => String(r.id).trim() === targetId);
        
        if (!record) {
            return res.status(404).json({ error: `Record ${targetId} not found` });
        }
        
        res.json(record);
    } catch (err) {
        console.error("Error fetching record:", err);
        res.status(500).json({ error: "Failed to fetch record" });
    }
});

// POST a new record 
app.post('/api/records', async (req, res) => {
    const { activityId, amount } = req.body;
    if (!activityId || !amount) return res.status(400).json({ error: "Missing fields" });

    try {
        const activities = await readData(ACTIVITIES_FILE);
        const records = await readData(RECORDS_FILE);

        // Find the activity to get the name and rate
        const activity = activities.find(a => a.id === activityId);
        if (!activity) return res.status(404).json({ error: "Activity type not found" });

        const newRecord = {
            id: Date.now().toString(), // Simple unique ID
            date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
            activityId: activityId,
            activityName: activity.name,
            amount: parseFloat(amount),
            co2Amount: parseFloat((amount * activity.carbonUnitRate).toFixed(2))
        };

        records.push(newRecord);
        await writeData(RECORDS_FILE, records);
        res.status(201).json(newRecord);
    } catch (err) {
        res.status(500).json({ error: "Server error saving record" });
    }
});

// PUT (update) a record 
// PUT (update) a record 
app.put('/api/records/:id', async (req, res) => {
    try {
        const records = await readData(RECORDS_FILE);
        const activities = await readData(ACTIVITIES_FILE);
        
        // Use String() and trim() to ensure "2" matches 2 or " 2 "
        const targetId = String(req.params.id).trim();
        const index = records.findIndex(r => String(r.id).trim() === targetId);

        if (index === -1) {
            // This will help you see exactly what the server is looking for vs what it has
            console.log(`Failed to find ID: [${targetId}] in`, records.map(r => r.id));
            return res.status(404).send("Record ID not found in database");
        }

        const { activityId, amount } = req.body;
        const activity = activities.find(a => String(a.id) === String(activityId));

        if (!activity) {
            return res.status(400).send("Linked Activity Type not found");
        }

        // Update the record and recalculate
        records[index] = {
            ...records[index],
            activityId: activityId,
            activityName: activity.name,
            amount: parseFloat(amount),
            co2Amount: parseFloat((parseFloat(amount) * activity.carbonUnitRate).toFixed(2))
        };

        await writeData(RECORDS_FILE, records);
        res.json(records[index]);
    } catch (err) {
        console.error("Server Error during PUT:", err);
        res.status(500).send("Internal Server Error");
    }
});

// DELETE a record
app.delete('/api/records/:id', async (req, res) => {
    let records = await readData(RECORDS_FILE);
    records = records.filter(r => r.id !== req.params.id);
    await writeData(RECORDS_FILE, records);
    res.status(204).send();
});

module.exports = app;