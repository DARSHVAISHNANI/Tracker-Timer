// --- DOM ELEMENTS ---
const monthPicker = document.getElementById('month-picker');
const loadReportBtn = document.getElementById('load-report-btn');
const chartCanvas = document.getElementById('monthly-bar-chart');
const tableContainer = document.getElementById('weekly-table-container');

// --- STATE ---
let monthlyChart;

// --- HELPER FUNCTIONS ---
function formatDuration(ms) {
    if (!ms || ms < 60000) return "0m"; // Show 0m for less than a minute
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.join(' ');
}

function getWeekOfMonth(date) {
    const dayOfMonth = date.getDate();
    return Math.ceil(dayOfMonth / 7);
}

// --- CORE FUNCTIONS ---

/**
 * Main function to generate the report for a selected month
 */
function generateMonthlyReport() {
    const selectedMonth = monthPicker.value; // e.g., "2025-10"
    if (!selectedMonth) {
        alert("Please select a month.");
        return;
    }

    const timeLogs = JSON.parse(localStorage.getItem('timeLogs')) || {};
    const monthlyData = {};

    // 1. Filter and aggregate data for the selected month
    for (const dateString in timeLogs) {
        if (dateString.startsWith(selectedMonth)) {
            const date = new Date(dateString);
            const week = getWeekOfMonth(date); // Week 1, 2, 3, 4, or 5
            const dailyLogs = timeLogs[dateString];

            for (const category in dailyLogs) {
                if (!monthlyData[category]) {
                    // Initialize if first time seeing this category
                    monthlyData[category] = { W1: 0, W2: 0, W3: 0, W4: 0, W5: 0, Total: 0 };
                }
                const duration = dailyLogs[category];
                monthlyData[category][`W${week}`] += duration;
                monthlyData[category].Total += duration;
            }
        }
    }
    
    // 2. Render the UI components
    renderBarChart(monthlyData);
    renderWeeklyTable(monthlyData);
}

/**
 * Renders the summary bar chart
 */
function renderBarChart(data) {
    const labels = Object.keys(data);
    const totals = labels.map(cat => (data[cat].Total / (1000 * 60 * 60)).toFixed(2)); // in hours

    if (monthlyChart) {
        monthlyChart.destroy(); // Destroy old chart before creating a new one
    }

    monthlyChart = new Chart(chartCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Hours Spent',
                data: totals,
                backgroundColor: '#007BFF',
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal bar chart
            scales: {
                x: { ticks: { color: '#fff' } },
                y: { ticks: { color: '#fff' } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

/**
 * Renders the detailed weekly table
 */
function renderWeeklyTable(data) {
    let tableHTML = `
        <table class="report-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Week 1</th>
                    <th>Week 2</th>
                    <th>Week 3</th>
                    <th>Week 4</th>
                    <th>Week 5</th>
                    <th>Monthly Total</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (Object.keys(data).length === 0) {
        tableHTML += `<tr><td colspan="7">No data found for this month.</td></tr>`;
    } else {
        for (const category in data) {
            const weekData = data[category];
            tableHTML += `
                <tr>
                    <td class="category-name">${category}</td>
                    <td>${formatDuration(weekData.W1)}</td>
                    <td>${formatDuration(weekData.W2)}</td>
                    <td>${formatDuration(weekData.W3)}</td>
                    <td>${formatDuration(weekData.W4)}</td>
                    <td>${formatDuration(weekData.W5)}</td>
                    <td><strong>${formatDuration(weekData.Total)}</strong></td>
                </tr>
            `;
        }
    }

    tableHTML += `</tbody></table>`;
    tableContainer.innerHTML = tableHTML;
}

/**
 * Initializes the page
 */
function initializeMonthlyReport() {
    // Set default month to the current month
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    monthPicker.value = `${year}-${month}`;

    // Generate report for the default month
    generateMonthlyReport();

    // Add event listener
    loadReportBtn.addEventListener('click', generateMonthlyReport);
}

// --- START THE APP ---
initializeMonthlyReport();