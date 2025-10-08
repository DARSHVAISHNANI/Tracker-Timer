// --- CONFIGURATION & STATE ---
const TOTAL_DAY_HOURS = 9;
let currentDate = new Date().toISOString().split('T')[0];
let plannerLogs = {};
let categories = [];
let planChart;

// --- DOM ELEMENTS ---
const totalHoursDisplay = document.getElementById('total-hours-display');
const chartCanvas = document.getElementById('plan-pie-chart');
const categoryNameInput = document.getElementById('new-category-name');
const categoryTargetInput = document.getElementById('new-category-target');
const addPlanBtn = document.getElementById('add-plan-btn');
const plannedList = document.getElementById('planned-list');
const datePicker = document.getElementById('date-picker-input');
const loadDayBtn = document.getElementById('load-day-btn');
const currentDayDisplay = document.getElementById('current-day-display');

// --- FUNCTIONS ---

function formatDisplayDate(dateString) {
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
    return adjustedDate.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

function loadNewDay() {
    const selectedDate = datePicker.value;
    if (!selectedDate) {
        alert('Please select a date.');
        return;
    }
    localStorage.setItem('currentDate', selectedDate);
    window.location.reload();
}

function updatePieChart() {
    const allocatedHours = categories.reduce((sum, cat) => sum + cat.target, 0);
    const timeLeft = TOTAL_DAY_HOURS - allocatedHours;
    const labels = categories.map(cat => cat.name);
    const data = categories.map(cat => cat.target);
    if (timeLeft > 0 || labels.length === 0) {
        labels.push('Unallocated');
        data.push(timeLeft < 0 ? 0 : timeLeft);
    }
    planChart.data.labels = labels;
    planChart.data.datasets[0].data = data;
    planChart.update();
}

/**
 * MODIFIED: Renders the list and adds a delete button to each item.
 */
function renderPlannedList() {
    plannedList.innerHTML = '';
    categories.forEach((cat, index) => {
        const li = document.createElement('li');
        
        // Create a container for the name and target
        const infoDiv = document.createElement('div');
        infoDiv.innerHTML = `<span>${cat.name}</span> — <strong>${cat.target} hr(s)</strong>`;
        
        // Create the delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'X';
        // Add an event listener to call the delete function with the correct index
        deleteBtn.addEventListener('click', () => deleteCategoryFromPlan(index));
        
        li.appendChild(infoDiv);
        li.appendChild(deleteBtn);
        plannedList.appendChild(li);
    });
}

/**
 * NEW: Deletes a category from the plan at a specific index.
 */
function deleteCategoryFromPlan(index) {
    // Remove the item from our current day's category array
    categories.splice(index, 1);

    // Update the master planner object and save to localStorage
    plannerLogs[currentDate] = categories;
    localStorage.setItem('plannerLogs', JSON.stringify(plannerLogs));

    // Re-render the UI to reflect the change
    renderPlannedList();
    updatePieChart();
}

function addCategoryToPlan() {
    const name = categoryNameInput.value.trim();
    const target = parseFloat(categoryTargetInput.value);
    if (!name || isNaN(target) || target <= 0) {
        alert('Please enter a valid category name and a positive target number of hours.');
        return;
    }
    if (categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
        alert('This category already exists for this day.');
        return;
    }
    const allocatedHours = categories.reduce((sum, cat) => sum + cat.target, 0);
    if (allocatedHours + target > TOTAL_DAY_HOURS) {
        alert(`Cannot add. This exceeds your total available time of ${TOTAL_DAY_HOURS} hours.`);
        return;
    }
    categories.push({ name, target });
    plannerLogs[currentDate] = categories;
    localStorage.setItem('plannerLogs', JSON.stringify(plannerLogs));
    renderPlannedList();
    updatePieChart();
    categoryNameInput.value = '';
    categoryTargetInput.value = '';
}

function initializePlanner() {
    const savedDate = localStorage.getItem('currentDate');
    if (savedDate) {
        currentDate = savedDate;
    }
    currentDayDisplay.textContent = formatDisplayDate(currentDate);
    datePicker.value = currentDate;
    totalHoursDisplay.textContent = `${TOTAL_DAY_HOURS} hours`;

    const savedPlannerLogs = JSON.parse(localStorage.getItem('plannerLogs'));
    if (savedPlannerLogs) {
        plannerLogs = savedPlannerLogs;
    }
    categories = plannerLogs[currentDate] || [];

    if (planChart) {
        planChart.destroy();
    }

    planChart = new Chart(chartCanvas, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                label: 'Hours',
                data: [],
                backgroundColor: ['#007BFF', '#4CAF50', '#f44336', '#ffc107', '#673ab7', '#e91e63', '#333'],
                borderColor: '#1e1e1e',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top', labels: { color: '#fff' } }
            }
        }
    });

    renderPlannedList();
    updatePieChart();

    addPlanBtn.addEventListener('click', addCategoryToPlan);
    loadDayBtn.addEventListener('click', loadNewDay);
}

// --- START THE APP ---
initializePlanner();