# CarbonFootprint API

### Base URL
`http://localhost:3000/api`

<br>

## Content Types
The API exclusively uses **JSON** for both request and response bodies. You should set the `Content-Type: application/json` header for POST and PUT requests.

<br>

## Global Status Codes
| Status | Name | Description |
| :--- | :--- | :--- |
| 200 | OK | Success. |
| 201 | Created | Resource created successfully. |
| 204 | No Content | Success, no response body. |
| 400 | Bad Request | Validation error or missing fields. |
| 404 | Not Found | Resource not found. |
| 500 | Internal Server Error | Unexpected server error. |

<br><br><br>

---
---

<br>

# Activities
Activity Types define categories of carbon emissions (e.g. "Car Travel") and their associated carbon unit rates.

<br>

### GET Activities
`GET /activities`

Returns a list of all Activity Types.

#### Optional Query Parameters
| Name | Type | Description |
| :--- | :--- | :--- |
| name | string | Filter Activity Types by name (partial match, case-insensitive). |

#### Response Elements
| Element | Type | Description |
| :--- | :--- | :--- |
| id | string | Unique identifier (Timestamp-based). |
| name | string | The name of the activity category. |
| unit | string | The measurement unit (e.g., km, kWh). |
| carbonUnitRate | number| The kg of CO2 emitted per unit. |

#### Example Response
**Status: 200 OK**
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

---

<br>

### POST Activities
`POST /activities`

Creates a new Activity Type.

#### Request Body
| Field | Type | Description |
| :--- | :--- | :--- |
| name | string | **Required**. Descriptive name for the Activity Type. |
| unit | string | **Required**. Measurement unit. |
| carbonUnitRate | number | **Required**. Emission rate (can be negative for offsets). |

#### Example Request
```json
{
  "name": "Bus Travel",
  "unit": "km",
  "carbonUnitRate": 0.1
}
```

#### Example Response
**Status: 201 Created**
```json
{
  "message": "Activity added"
}
```

<br>

---

<br>

### PUT Activities
`PUT /activities/{id}`

Updates an existing Activity Type.

#### URL Parameters
| Parameter | Description |
| :--- | :--- |
| id | **Required**. The unique ID of the Activity Type. |

#### Request Body
Allows partial updates. You only need to include the fields you wish to change with the `id` provided in the URL.
```json
{
  "name": "Bus Travel (Updated)",
  "carbonUnitRate": 0.08
}
```

#### Example Response
**Status: 200 OK**
```json
{
  "id": "1705423853000",
  "name": "Bus Travel (Updated)",
  "unit": "km",
  "carbonUnitRate": 0.08
}
```

<br>

---

<br>

### DELETE Activities
`DELETE /activities/{id}`

Deletes an activity type. **Warning:** This will also automatically delete all Records associated with this Activity Type.

**Response**
(204 No Content)

#### Example Request
`DELETE /api/activities/1706227200002`

#### Example Response
**Status: 204 No Content**
*(Empty Body)*

<br><br><br>

---
---

<br>

# Records
Records are specific instances of a daily activity, associated with an Activity Type.

<br>

### GET Records
`GET /records`

Retrieves a filtered list of logged carbon records.

#### OptionalQuery Parameters
| Name | Type | Description |
| :--- | :--- | :--- |
| activityId | string | Filter records by a parent Activity Type ID. |
| name | string | Filter by the record's specific description. |

#### Response Elements
| Element | Type | Description |
| :--- | :--- | :--- |
| id | string | Unique record identifier. |
| date | string | The event date (YYYY-MM-DD). |
| activityId | string | The ID of the linked activity type. |
| activityName | string | The user-provided description for this record. |
| amount | number | The quantity log (must be positive). |
| co2Amount | number | The server-calculated CO2 impact in kg. |

#### Example Response
**Status: 200 OK**
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

---

<br>

### POST Records
`POST /records`

Creates a new carbon record and automatically calculates the CO2 amount based on the Activity Type's carbonUnitRate.
#### Request Body
| Field | Type | Description |
| :--- | :--- | :--- |
| activityId | string | **Required**. Valid Activity Type ID. |
| activityName | string | **Required**. Instance name (e.g. "Trip to Supermarket"). |
| amount | number | **Required**. Quantity performed. |
| date | string | **Required**. Date in YYYY-MM-DD format. |

#### Example Request
```json
{
  "activityId": "1706227200000",
  "activityName": "Morning Drive",
  "amount": 10,
  "date": "2024-01-21"
}
```

#### Example Response
**Status: 201 Created**
```json
{
  "id": "1706227600000",
  "date": "2024-01-21",
  "activityId": "1706227200000",
  "activityName": "Morning Drive",
  "amount": 10,
  "co2Amount": 1.5
}
```

<br>

---

<br>

### PUT Records
`PUT /records/{id}`

Updates an existing record and recalculates the CO2 amount.

#### URL Parameters
| Parameter | Description |
| :--- | :--- |
| id | **Required**. The unique ID of the record. |

#### Request Body
| Field | Type | Description |
| :--- | :--- | :--- |
| activityId | string | The ID of the parent activity type. |
| activityName | string | Updated instance name. |
| amount | number | Updated quantity. |
| date | string | Updated date. |

#### Example Request
```json
{
  "activityId": "1706227200000",
  "activityName": "Evening Drive (Updated)",
  "amount": 15,
  "date": "2024-01-21"
}
```

#### Example Response
**Status: 200 OK**
```json
{
  "id": "1706227600000",
  "date": "2024-01-21",
  "activityId": "1706227200000",
  "activityName": "Evening Drive (Updated)",
  "amount": 15,
  "co2Amount": 2.25
}
```

<br>

---

<br>

### DELETE Records
`DELETE /records/{id}`

Removes a specific Record.

#### Example Response
**Status: 204 No Content**
*(Empty Body)*

<br><br><br>

---
---

<br>

# Settings
Global user configuration.

<br>

### GET Settings
`GET /settings`

Retrieves the current user settings, only the daily carbon goal in this implementation.

#### Example Response
**Status: 200 OK**
```json
{
  "dailyCarbonGoal": 15.0
}
```

<br>

---

<br>

### PUT Settings
`PUT /settings`

Updates the user settings.

#### Request Body
| Field | Type | Description |
| :--- | :--- | :--- |
| dailyCarbonGoal | number | **Required**. The new daily target in kg. |

#### Example Request
```json
{
  "dailyCarbonGoal": 20.0
}
```

#### Example Response
**Status: 200 OK**
```json
{
  "dailyCarbonGoal": 20.0
}
```
