const request = require('supertest');
const app = require('../server/app');

describe('Activity API', () => {
    it('should GET all activities', async () => {
        const res = await request(app).get('/api/activities');
        expect(res.statusCode).toEqual(200);
        expect(Array.isArray(res.body)).toBeTruthy();
    });

    it('should create a new activity via POST', async () => {
        const newAct = { id: "test", name: "Test Act", unit: "unit", carbonUnitRate: 1 };
        const res = await request(app).post('/api/activities').send(newAct);
        expect(res.statusCode).toEqual(201);
    });
});