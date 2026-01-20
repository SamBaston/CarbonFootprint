/* eslint-disable no-undef */

'use strict';

const request = require('supertest');
const fs = require('fs').promises;

// Mock the fs module so we don't use the real data files
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn()
    }
}));

const app = require('../server/app');

describe('EcoTrack API Service', () => {
    let mockActivities;
    let mockRecords;
    let mockSettings;

    // Reset mock data before each test
    beforeEach(() => {
        mockActivities = [
            { id: "1", name: "Car Travel", unit: "km", carbonUnitRate: 0.15 },
            { id: "2", name: "Bus Travel", unit: "km", carbonUnitRate: 0.05 }
        ];

        mockRecords = [
            {
                id: "101",
                date: "2023-01-01",
                activityId: "1",
                activityName: "Car Travel",
                amount: 100,
                co2Amount: 15.0
            }
        ];

        mockSettings = { dailyGoal: 15.0 };

        jest.clearAllMocks();

        // Setup read and write mocks to return the mock data
        fs.readFile.mockImplementation(async (filePath) => {
            if (filePath.includes('activities.json')) {
                return JSON.stringify(mockActivities);
            }
            if (filePath.includes('records.json')) {
                return JSON.stringify(mockRecords);
            }
            if (filePath.includes('settings.json')) {
                return JSON.stringify(mockSettings);
            }
            throw new Error("File not found");
        });
        fs.writeFile.mockImplementation(async (filePath, data) => {
            const parsed = JSON.parse(data);
            if (filePath.includes('activities.json')) {
                mockActivities = parsed;
            }
            if (filePath.includes('records.json')) {
                mockRecords = parsed;
            }
            if (filePath.includes('settings.json')) {
                mockSettings = parsed;
            }
        });
    });



    //---------------------------------------------//
    /** -------- ACTIVITY TYPE ENDPOINTS -------- **/
    //---------------------------------------------//
    describe('Activity Type Endpoints', () => {

        /** -- Test GET Requests -- **/
        test('GET /api/activities succeeds', () => {
            return request(app)
                .get('/api/activities')
                .expect(200)
                .expect('Content-Type', /json/);
        });
        test('GET /api/activities includes specific activity', () => {
            return request(app)
                .get('/api/activities')
                .expect(/Car Travel/);
        });

        /** -- Test POST Requests -- **/
        test('POST /api/activities succeeds', () => {
            const newActivity = { name: "Train", unit: "km", carbonUnitRate: 0.03 };
            return request(app)
                .post('/api/activities')
                .send(newActivity)
                .expect(201);
        });
        test('POST /api/activities fails with missing fields', () => {
            return request(app)
                .post('/api/activities')
                .send({ unit: "km" })
                .expect(400);
        });

        /** -- Test PUT Requests -- **/
        test('PUT /api/activities/:id succeeds', () => {
            const updateData = { name: "Updated Car", carbonUnitRate: 0.2 };
            return request(app)
                .put('/api/activities/1')
                .send(updateData)
                .expect(200)
                .expect(/Updated Car/);
        });

        /** -- Test DELETE Requests -- **/
        test('DELETE /api/activities/:id succeeds', () => {
            return request(app)
                .delete('/api/activities/1')
                .expect(204);
        });
    });



    //---------------------------------------------//
    /** ----------- RECORDS ENDPOINTS ----------- **/
    //---------------------------------------------//
    describe('Records Endpoints', () => {

        /** -- Test GET Requests -- **/
        test('GET /api/records succeeds', () => {
            return request(app)
                .get('/api/records')
                .expect(200)
                .expect('Content-Type', /json/);
        });
        test('GET /api/records returns correct data structure', () => {
            return request(app)
                .get('/api/records')
                .expect(res => {
                    if (!Array.isArray(res.body)) throw new Error("Body is not an array");
                    if (res.body[0].activityName !== "Car Travel") throw new Error("Incorrect data");
                });
        });
        test('GET /api/records/:id succeeds', () => {
            return request(app)
                .get('/api/records/101')
                .expect(200)
                .expect(/101/);
        });
        test('GET /api/records/:id returns 404 for missing record', () => {
            return request(app)
                .get('/api/records/999')
                .expect(404);
        });

        /** -- Test POST Requests -- **/
        test('POST /api/records succeeds and calculates CO2', () => {
            const newRecord = {
                date: "2023-01-02",
                activityId: "2", // Bus (rate 0.05)
                activityName: "Bus Travel",
                amount: 200
            };
            // Expect CO2 = 200 * 0.05 = 10.0
            return request(app)
                .post('/api/records')
                .send(newRecord)
                .expect(201)
                .expect(res => {
                    if (res.body.co2Amount !== 10.0) throw new Error(`Expected CO2 10.0, got ${res.body.co2Amount}`);
                });
        });

        /** -- Test PUT Requests -- **/
        test('PUT /api/records/:id succeeds', () => {
            const updateData = {
                date: "2023-01-01",
                activityId: "1",
                activityName: "Car Travel",
                amount: 200
            };
            return request(app)
                .put('/api/records/101')
                .send(updateData)
                .expect(200)
                .expect(res => {
                    // New CO2 = 200 * 0.15 = 30.0
                    if (res.body.co2Amount !== 30.0) throw new Error(`Expected CO2 30.0, got ${res.body.co2Amount}`);
                });
        });

        /** -- Test DELETE Requests -- **/
        test('DELETE /api/records/:id succeeds', () => {
            return request(app)
                .delete('/api/records/101')
                .expect(204);
        });
    });



    //---------------------------------------------//
    /** ---------- SETTINGS ENDPOINTS ----------- **/
    //---------------------------------------------//
    describe('Settings Endpoints', () => {

        /** -- Test GET Requests -- **/
        test('GET /api/settings succeeds', () => {
            return request(app)
                .get('/api/settings')
                .expect(200)
                .expect('Content-Type', /json/)
                .expect(res => {
                    if (res.body.dailyGoal !== 15.0) throw new Error("Incorrect daily goal");
                });
        });

        /** -- Test PUT Requests -- **/
        test('PUT /api/settings succeeds', () => {
            return request(app)
                .put('/api/settings')
                .send({ dailyGoal: 20.5 })
                .expect(200)
                .expect(res => {
                    if (res.body.dailyGoal !== 20.5) throw new Error("Goal not updated");
                });
        });
        test('PUT /api/settings fails with missing dailyGoal', () => {
            return request(app)
                .put('/api/settings')
                .send({})
                .expect(400);
        });
    });
});