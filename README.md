# EcoTrack - Carbon Footprint Tracker

## Overview
This is a web-based single-page dashboard application designed to help a user track their carbon footprint. It allows them to log various daily activities and see the resulting carbon emissions.

This was built in accordance with my [Programming Black Assignment 1 Mark Scheme](https://github.com/stevenaeola/progblack_2526/blob/main/assignment_1/README.md).

## Features

### Dashboard
The main page of the application, providing a summary of their environmental impact.
*   **Time Range Selection**: Filter data by Today, Past 7 Days, Past 30 Days, Past 90 Days, or Past Year. 
*   **Period Comparison**: Compare the current emissions to the previous equivalent time period (e.g., "15% lower than previous period").
*   **Emissions Breakdown**: A ranked list showing which activities are contributing the most to their footprint.
*   **Carbon Emission Chart**: An interactive line graph visualizing emission trends over time, filterable by Activity Type. 
*   **Yearly Carbon Heatmap**: A GitHub-style contribution graph visualizing daily carbon emissions in relation to their daily carbon goal. Additional stats show the percentage of days in a selected year that goal was met, and the average daily carbon value. 

### Activity & Record Management
Manage data entries and catagories. 
*   **Activity Types**: Custom activities with specific units (km, kWh) and carbon rates to be used on Activity Records.
*   **Activity Records**: Log specific activities and link them to the relevenat Activity Type.
*   **Sorting**: Clicking on any table header will sort the table by said column. Clicking again will reverse the order.
*   **CRUD Operations**: Fully functional interface to **C**reate, **R**ead, **U**pdate, and **D**elete both Activity Types and Records.
*   **Cascading Deletes**: Deleting an Activity Type automatically removes all associated Records to prevent orphaned data.

## Technology Stack

### Backend
*   **[Node.js](https://nodejs.org/docs/latest/api/)**: Runtime environment.
*   **[Express](https://expressjs.com/en/4x/api.html)**: Web server framework.
*   **[Jest](https://jestjs.io/docs/getting-started)**: Testing framework.
*   **[Supertest](https://github.com/ladjs/supertest)**: HTTP assertions.
*   **[fs (File System)](https://nodejs.org/api/fs.html)**: JSON-based data persistence (no external database allowed).

### Frontend
*   **[Bootstrap 5](https://getbootstrap.com/docs/5.3/getting-started/introduction/)**: Responsive layout and styling.
*   **[Chart.js](https://www.chartjs.org/docs/latest/)**: Rendering interactive data visualizations (Emissions Chart).
*   **[date-fns](https://date-fns.org/docs/Getting-Started)**: Lightweight date utility library (Dashboard Date Picker).
*   **[Heat.js](https://www.william-troup.com/heat-js/index.html)**: Not used directly, but was used as a reference for the Yearly Carbon Heatmap.
*   **Vanilla JavaScript**: Core application logic.

## API Documentation
For information on the API endpoints, please see my [documentation](docs/API.md).

## Installation & Testing

1.  **Prerequisites**: Ensure you have [Node.js](https://nodejs.org/) installed.
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Run the Server**:
    ```bash
    npm start
    ```
    The application will be available at `http://localhost:3000`.

4.  **Run Tests**:
    ```bash
    npm test
    ```
    This runs the Jest test suite to verify the backend API endpoints.
