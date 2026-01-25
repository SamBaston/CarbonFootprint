# EcoTrack API Documentation

Base URL: `http://localhost:3000/api`

<br><br>

## Activity Types

### Get Activities
`GET /activities`

Retrieves a list of all activity types.
    
**Query Parameters**
*   `name` (optional): Filter activities by name (case-insensitive).

**Response**
```json
[
  {
    "id": "1705423851000",
    "name": "Car Travel",
    "unit": "km",
    "carbonUnitRate": 0.15
  },
  {
    "id": "1705423852000",
    "name": "Electricity",
    "unit": "kWh",
    "carbonUnitRate": 0.233
  }
]
```

<br>

### Create Activity
`POST /activities`

Creates a new activity type.

**Request Body**
```json
{
  "name": "Bus Travel",
  "unit": "km",
  "carbonUnitRate": 0.1
}
```

**Response**
```json
{
  "message": "Activity added"
}
```

<br>

### Update Activity
`PUT /activities/:id`

Updates an existing activity type.

**Request Body**
```json
{
  "name": "Bus Travel (Updated)",
  "carbonUnitRate": 0.08
}
```

**Response**
```json
{
  "id": "1705423853000",
  "name": "Bus Travel (Updated)",
  "unit": "km",
  "carbonUnitRate": 0.08
}
```

<br>

### Delete Activity
`DELETE /activities/:id`

Deletes an activity type. **Warning:** This will also automatically delete all Records associated with this Activity Type.

**Response**
(204 No Content)



<br><br><br>



## Records

### Get Records
`GET /records`

Retrieves all logged records.

**Query Parameters**
*   `activityId` (optional): Filter records by a specific Activity ID.

**Response**
```json
[
  {
    "id": "1705424001000",
    "date": "2024-01-15",
    "activityId": "1705423851000",
    "activityName": "Car Travel",
    "amount": 50,
    "co2Amount": 7.5
  }
]
```

<br>

### Log Record
`POST /records`

Creates a new carbon record and automatically calculates the CO2 amount based on the Activity Type's carbonUnitRate.

**Request Body**
```json
{
  "date": "2024-01-16",
  "activityId": "1705423851000",
  "activityName": "Car Travel",
  "amount": 100
}
```

**Response**
```json
{
  "id": "1705424100000",
  "date": "2024-01-16",
  "activityId": "1705423851000",
  "activityName": "Car Travel",
  "amount": 100,
  "co2Amount": 15.0
}
```

<br>

### Update Record
`PUT /records/:id`

Updates an existing record and recalculates the CO2 amount.

**Request Body**
```json
{
    "date": "2024-01-16",
    "activityId": "1705423851000",
    "activityName": "Car Travel",
    "amount": 200
}
```

**Response**
```json
{
    "id": "1705424100000",
    "date": "2024-01-16",
    "activityId": "1705423851000",
    "activityName": "Car Travel",
    "amount": 200,
    "co2Amount": 30.0
}
```

<br>

### Delete Record
`DELETE /records/:id`

Deletes a specific record.

**Response**
(204 No Content)



<br><br><br>



## Settings

### Get Settings
`GET /settings`

Retrieves the current user settings, such as the daily carbon goal.

**Response**
```json
{
  "dailyCarbonGoal": 15.0
}
```

<br>

### Update Settings
`PUT /settings`

Updates the user settings.

**Request Body**
```json
{
  "dailyCarbonGoal": 20.0
}
```

**Response**
```json
{
  "dailyCarbonGoal": 20.0
}
```
