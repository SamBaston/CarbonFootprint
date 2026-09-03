# CarbonFootprint
### Personal Carbon Footprint Tracker

## Overview
This is a web-based single-page dashboard application designed to help a user track their carbon footprint. It allows them to log various daily activities and see the resulting carbon emissions.

Link to a free-tier cold-start delay [live demo](https://carbonfootprint-m8gx.onrender.com/).

This was built in accordance with my [Programming Black Assignment 1 Mark Scheme](https://github.com/stevenaeola/progblack_2526/blob/main/assignment_1/README.md).

Grade: 79/100

<br>

## Features

### Dashboard
Displays high-level stats and trends.
*   **Time Range Selection**: Filter data by Today, Past 7 Days, Past 30 Days, Past 90 Days, or Past Year. 
*   **Period Comparison**: Compare the current emissions to the previous equivalent time period (e.g., "15% lower than previous period").
*   **Emissions Breakdown**: A ranked list showing which activities are contributing the most to their footprint.
*   **Carbon Emission Chart**: An interactive line graph visualizing emission trends over time, filterable by Activity Type. 
*   **Yearly Carbon Heatmap**: A GitHub-style contribution graph visualizing daily carbon emissions in relation to their daily carbon goal. Additional stats show the percentage of days in a selected year that goal was met, and the average daily carbon value. 

### Activity & Record Management
Manage data entries and catagories. 
*   **Activity Types**: Custom activities with specific units (km, kWh) and carbon rates to be used on Activity Records.
*   **Activity Records**: Log specific activities and link them to the relevenat Activity Type.
*   **Search & Filtering**: Searching for Activities by name and filtering Records by Activity Type and/or Name.
*   **Sorting**: Clicking on any table header will sort the table by said column. Clicking again will reverse the order.
*   **CRUD Operations**: Fully functional interface to **C**reate, **R**ead, **U**pdate, and **D**elete both Activity Types and Records.
*   **Cascading Deletes**: Deleting an Activity Type automatically removes all associated Records to prevent orphaned data.


<br>

## Tech Stack

### Backend
*   **[Node.js](https://nodejs.org/docs/latest/api/)**: Runtime environment.
*   **[Express](https://expressjs.com/en/4x/api.html)**: Web server framework.
*   **[Jest](https://jestjs.io/docs/getting-started)**: Testing framework.
*   **[Supertest](https://github.com/ladjs/supertest)**: HTTP assertions.
*   **[fs (File System)](https://nodejs.org/api/fs.html)**: JSON-based data persistence (no external database allowed).

### Frontend
*   **[Bootstrap 5](https://getbootstrap.com/docs/5.3/getting-started/introduction/)**: Responsive layout and styling.
*   **[Nu Html Checker](https://validator.w3.org/nu/#textarea)**: HTML valitation tool.
*   **[Chart.js](https://www.chartjs.org/docs/latest/)**: Rendering interactive data visualizations (Emissions Chart).
*   **[date-fns](https://date-fns.org/docs/Getting-Started)**: Lightweight date utility library (Dashboard Date Picker).
*   **Vanilla JavaScript**: Core application logic.


<br>

## Additional Resources

These are resources that I haven't used directly but have at least taken inspiration from.

*   **[Heat.js](https://www.william-troup.com/heat-js/index.html)**: I attempted to use this library for the Yearly Carbon Heatmap, but it did not quite suit my needs in relation to the different colouring based on daily carbon totals, so I ended up using a custom solution. Even still, it was a useful starting point.
*   **[TrackZero](https://www.trackzero.eco/)**: An example platform used for tracking carbon emissions. It gave some inspiration for the layout of the dashboard and metrics a user would need.
*   **Programming Black [22/23](https://github.com/stevenaeola/progblack_2223/tree/main/Examples) and [23/24](https://github.com/stevenaeola/progblack_2324/tree/main/examples) examples**: The 25/26 repo doesn't have any examples, but the 22/23 and 23/24 repos do, and all the provided mark schemes are essentially identical. 
*   **[Xero API Documentation](https://developer.xero.com/documentation/api/accounting/accounts)**: Not a similar platfrom, but I like their API documentation style.

<br>

## API Documentation
For information on the API endpoints, please see my [documentation](docs/API.md).


<br>

## Possible Future Improvements
Due to the mark scheme I had to adheare to, there were limitations on what I could do. For example, no user accounts/authentication, single page application, no external databases, etc. If I were to continue working on this project, I would add (in no particular order):

*   User accounts/authentication
*   External database in place of JSON files
*   Improved file structure
*   Automated record generation
*   Unit tests for frontend
*   Copy and paste functionality for Activity Types and Records
*   More modern UI (less reliance on bootstrap)
*   Dark and Light mode UI toggle
*   Data import/export functionality (JSON and/or CSV)
*   Exclude from reporting toggle for Activity Types and Records
*   Activity Type filters to be multiselectable
*   Favouritable Activity Types for quick access

<br>

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
