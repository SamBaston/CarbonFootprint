const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();

app.use(express.json());

const ACTIVITIES_FILE = path.join(__dirname, '../data/activities.json');
const RECORDS_FILE = path.join(__dirname, '../data/records.json');
const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

// Check if the settings file exists, set defaults if not
async function checkSettings() {
    const files = [
        { path: SETTINGS_FILE, default: { dailyCarbonGoal: 15.0 } },
        { path: ACTIVITIES_FILE, default: [] },
        { path: RECORDS_FILE, default: [] }
    ];

    for (const file of files) {
        try {
            await fs.access(file.path);
        } catch {
            await writeData(file.path, file.default);
        }
    }
}
checkSettings();

// Read from JSON files
async function readData(filePath) {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
}

// Write to JSON files
async function writeData(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}



//---------------------------------------------//
/** -------- ACTIVITY TYPE ENDPOINTS -------- **/
//---------------------------------------------//

// GET all activity types (searchable)
app.get('/api/activities', async (req, res) => {
    try {
        let activities = await readData(ACTIVITIES_FILE);

        const { name, extend, active, favorite } = req.query;
        if (name) {
            const term = name.toLowerCase();
            activities = activities.filter(activity => activity.name.toLowerCase().includes(term));
        }

        if (active === 'true') {
            activities = activities.filter(activity => !activity.hideInDropdown);
        }

        if (favorite === 'true') {
            activities = activities.filter(activity => activity.isFavorite);
        }

        if (extend === 'records') {
            const records = await readData(RECORDS_FILE);
            activities = activities.map(activity => ({
                ...activity,
                records: records.filter(r => String(r.activityId) === String(activity.id))
            }));
        }

        res.json(activities);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to read activities" });
    }
});

// GET a specific activity type
app.get('/api/activities/:id', async (req, res) => {
    try {
        const activities = await readData(ACTIVITIES_FILE);
        const targetId = String(req.params.id).trim();
        let activity = activities.find(a => String(a.id).trim() === targetId);

        if (!activity) {
            return res.status(404).json({ error: `Activity ${targetId} not found` });
        }

        if (req.query.extend === 'records') {
            const records = await readData(RECORDS_FILE);
            activity = {
                ...activity,
                records: records.filter(r => String(r.activityId) === String(activity.id))
            };
        }

        res.json(activity);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch activity" });
    }
});

// POST new activity type
app.post('/api/activities', async (req, res) => {
    try {
        const { name, unit, carbonUnitRate } = req.body;
        if (!name || !unit || carbonUnitRate === undefined) return res.status(400).json({ error: "Missing fields" });

        const rate = parseFloat(carbonUnitRate);
        if (isNaN(rate)) return res.status(400).json({ error: "Rate must be a valid number" });

        const activities = await readData(ACTIVITIES_FILE);

        const newActivity = {
            id: Date.now().toString(), // Use the timestamp as a simple unique ID
            name: name,
            unit: unit,
            carbonUnitRate: carbonUnitRate,
            excludeFromDashboard: req.body.excludeFromDashboard || false,
            // New fields with mutual exclusivity check
            isFavorite: req.body.hideInDropdown ? false : (req.body.isFavorite || false),
            hideInDropdown: req.body.hideInDropdown || false
        };

        activities.push(newActivity);
        await writeData(ACTIVITIES_FILE, activities);
        res.status(201).json({ message: "Activity added" });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to add an activity" });
    }
});

// PUT (update) an activity type
app.put('/api/activities/:id', async (req, res) => {
    try {
        const activities = await readData(ACTIVITIES_FILE);
        const id = req.params.id;
        const index = activities.findIndex(activity => activity.id === id);
        if (index === -1) return res.status(404).json({ error: "Not found" });

        const oldRate = activities[index].carbonUnitRate;

        // Prepare updates
        const updates = { ...req.body };

        // Enforce constraint: can't be favorite and hidden
        if (updates.hideInDropdown) {
            updates.isFavorite = false;
        }

        activities[index] = { ...activities[index], ...updates };
        const newRate = activities[index].carbonUnitRate;

        await writeData(ACTIVITIES_FILE, activities);

        // If the rate has changed, perform a cascading update on all associated records
        if (oldRate !== newRate) {
            let records = await readData(RECORDS_FILE);
            let updated = false;

            records = records.map(record => {
                if (String(record.activityId) === String(id)) {
                    updated = true;
                    return {
                        ...record,
                        co2Amount: parseFloat((record.amount * newRate).toFixed(2))
                    };
                }
                return record;
            });

            if (updated) {
                await writeData(RECORDS_FILE, records);
            }
        }

        res.json(activities[index]);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update an activity" });
    }
});

// DELETE activity type
app.delete('/api/activities/:id', async (req, res) => {
    try {
        const id = req.params.id;

        // Remove associated records first
        let records = await readData(RECORDS_FILE);
        const initialRecordCount = records.length;
        records = records.filter(record => String(record.activityId) !== String(id));

        if (records.length !== initialRecordCount) {
            await writeData(RECORDS_FILE, records);
        }

        // Remove the activity
        let activities = await readData(ACTIVITIES_FILE);
        activities = activities.filter(activity => activity.id !== id);
        await writeData(ACTIVITIES_FILE, activities);

        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete an activity" });
    }
});



//---------------------------------------------//
/** ----------- RECORDS ENDPOINTS ----------- **/
//---------------------------------------------//

// GET all records (searchable & filterable)
app.get('/api/records', async (req, res) => {
    try {
        let records = await readData(RECORDS_FILE);
        const { activityId, name, extend } = req.query;

        if (activityId) {
            records = records.filter(record => String(record.activityId) === String(activityId));
        }
        if (name) {
            const term = name.toLowerCase();
            records = records.filter(record => record.activityName && record.activityName.toLowerCase().includes(term));
        }

        if (extend === 'activityType') {
            const activities = await readData(ACTIVITIES_FILE);
            records = records.map(record => ({
                ...record,
                activityType: activities.find(a => String(a.id) === String(record.activityId)) || null
            }));
        }

        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to read records" });
    }
});

// GET a specific record
app.get('/api/records/:id', async (req, res) => {
    try {
        const records = await readData(RECORDS_FILE);
        const targetId = String(req.params.id).trim();
        let record = records.find(record => String(record.id).trim() === targetId);

        if (!record) {
            return res.status(404).json({ error: `Record ${targetId} not found` });
        }

        if (req.query.extend === 'activityType') {
            const activities = await readData(ACTIVITIES_FILE);
            record = {
                ...record,
                activityType: activities.find(a => String(a.id) === String(record.activityId)) || null
            };
        }

        res.json(record);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch record" });
    }
});

// PUT (update) a record 
app.put('/api/records/:id', async (req, res) => {
    try {
        const records = await readData(RECORDS_FILE);
        const activities = await readData(ACTIVITIES_FILE);

        const targetId = String(req.params.id).trim();
        const index = records.findIndex(record => String(record.id).trim() === targetId);

        if (index === -1) return res.status(404).json({ error: "Record ID not found in database" });

        const { activityId, activityName, amount, date } = req.body;
        const activity = activities.find(activity => String(activity.id) === String(activityId));

        if (!activity) {
            return res.status(400).json({ error: "Linked Activity Type not found" });
        }

        const val = parseFloat(amount);
        if (isNaN(val) || val < 0) return res.status(400).json({ error: "Amount must be a positive number" });

        records[index] = {
            ...records[index],
            activityId: activityId,
            activityName: activityName,
            date: date,
            amount: val,
            co2Amount: parseFloat((val * activity.carbonUnitRate).toFixed(2)) // recalculate CO2 amount
        };

        await writeData(RECORDS_FILE, records);
        res.json(records[index]);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update a record" });
    }
});

// POST a new record 
app.post('/api/records', async (req, res) => {
    const { activityId, activityName, amount, date } = req.body;
    if (!activityId || !activityName || !amount || !date) return res.status(400).json({ error: "Missing fields" });
    if (parseFloat(amount) < 0) return res.status(400).json({ error: "Amount must be a positive number" });

    try {
        const activities = await readData(ACTIVITIES_FILE);
        const records = await readData(RECORDS_FILE);

        // Find the activity type to get the carbon rate
        const activity = activities.find(activity => activity.id === activityId);
        if (!activity) return res.status(404).json({ error: "Activity type not found" });

        const newRecord = {
            id: Date.now().toString(), // Use the timestamp as a simple unique ID
            date: date,
            activityId: activityId,
            activityName: activityName,
            amount: parseFloat(amount),
            co2Amount: parseFloat((amount * activity.carbonUnitRate).toFixed(2))
        };

        records.push(newRecord);
        await writeData(RECORDS_FILE, records);
        res.status(201).json(newRecord);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to save a record" });
    }
});

// DELETE a record
app.delete('/api/records/:id', async (req, res) => {
    try {
        let records = await readData(RECORDS_FILE);
        records = records.filter(record => record.id !== req.params.id);
        await writeData(RECORDS_FILE, records);
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete a record" });
    }
});



//---------------------------------------------//
/** ---------- SETTINGS ENDPOINTS ----------- **/
//---------------------------------------------//

app.get('/api/settings', async (req, res) => {
    try {
        const settings = await readData(SETTINGS_FILE);
        res.json(settings);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to read settings" });
    }
});

app.put('/api/settings', async (req, res) => {
    try {
        const { dailyCarbonGoal } = req.body;

        if (dailyCarbonGoal === undefined) {
            return res.status(400).json({ error: "Missing daily Carbon Goal value" });
        }

        const val = parseFloat(dailyCarbonGoal);
        if (isNaN(val) || val < 0) return res.status(400).json({ error: "Goal must be a positive number" });

        const settings = { dailyCarbonGoal: val };
        await writeData(SETTINGS_FILE, settings);
        res.json(settings);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update settings" });
    }
});



app.use(express.static('public')); // Serve frontend files

module.exports = app;