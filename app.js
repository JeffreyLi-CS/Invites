// Constants
const STATE_KEY = 'invites_state_v1';
const ORGANIZER_PASSWORD = 'admin';

// State management
function seedState() {
  return {
    event: {
      title: 'Dinner Plan',
      description: 'Vote on the time and place. After it locks, confirm if you\'re going.'
    },
    locked: false,
    organizer: {
      lockedAt: null,
      lockedTimeId: null,
      lockedLocationId: null
    },
    options: {
      times: [
        { id: 't1', label: 'Fri 7:00 PM' },
        { id: 't2', label: 'Sat 1:00 PM' },
        { id: 't3', label: 'Sun 11:00 AM' }
      ],
      locations: [
        { id: 'l1', label: 'Ramen Tatsu-Ya' },
        { id: 'l2', label: 'Home Poker Night' },
        { id: 'l3', label: 'Zilker Picnic' }
      ]
    },
    votes: {},
    rsvps: {}
  };
}

function loadState() {
  try {
    const stored = localStorage.getItem(STATE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  return seedState();
}

function saveState(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

// Utility functions
function normalizeName(name) {
  return name.trim().toLowerCase();
}

function computeTallies(state) {
  const timeCounts = {};
  const locationCounts = {};

  // Initialize counts
  state.options.times.forEach(t => {
    timeCounts[t.id] = 0;
  });
  state.options.locations.forEach(l => {
    locationCounts[l.id] = 0;
  });

  // Count votes
  Object.values(state.votes).forEach(vote => {
    if (vote.timeId && timeCounts.hasOwnProperty(vote.timeId)) {
      timeCounts[vote.timeId]++;
    }
    if (vote.locationId && locationCounts.hasOwnProperty(vote.locationId)) {
      locationCounts[vote.locationId]++;
    }
  });

  const totalVoters = Object.keys(state.votes).length;

  return { timeCounts, locationCounts, totalVoters };
}

function computeWinners(state) {
  const { timeCounts, locationCounts } = computeTallies(state);

  // Find winner by highest count, ties break by array order
  let winningTimeId = state.options.times[0].id;
  let maxTimeCount = timeCounts[winningTimeId];

  state.options.times.forEach(t => {
    if (timeCounts[t.id] > maxTimeCount) {
      maxTimeCount = timeCounts[t.id];
      winningTimeId = t.id;
    }
  });

  let winningLocationId = state.options.locations[0].id;
  let maxLocationCount = locationCounts[winningLocationId];

  state.options.locations.forEach(l => {
    if (locationCounts[l.id] > maxLocationCount) {
      maxLocationCount = locationCounts[l.id];
      winningLocationId = l.id;
    }
  });

  return { timeId: winningTimeId, locationId: winningLocationId };
}

// Rendering
function render() {
  const state = loadState();

  renderHeader(state);
  renderVotingSection(state);
  renderResultsSection(state);
  renderRSVPSection(state);
}

function renderHeader(state) {
  const header = document.getElementById('header');

  let html = `
    <div class="section">
      <h1>${escapeHtml(state.event.title)}</h1>
      <p>${escapeHtml(state.event.description)}</p>
  `;

  if (state.locked) {
    const timeLabel = state.options.times.find(t => t.id === state.organizer.lockedTimeId)?.label || '';
    const locationLabel = state.options.locations.find(l => l.id === state.organizer.lockedLocationId)?.label || '';
    const lockedDate = new Date(state.organizer.lockedAt);

    html += `
      <div class="locked-card">
        <h2>🔒 Locked Plan</h2>
        <div class="locked-details"><strong>Time:</strong> ${escapeHtml(timeLabel)}</div>
        <div class="locked-details"><strong>Location:</strong> ${escapeHtml(locationLabel)}</div>
        <div class="locked-time">Locked on ${lockedDate.toLocaleString()}</div>
      </div>
    `;
  }

  html += '</div>';
  header.innerHTML = html;
}

function renderVotingSection(state) {
  const section = document.getElementById('voting-section');

  if (state.locked) {
    section.innerHTML = '';
    return;
  }

  let html = `
    <h2>Cast Your Vote</h2>
    <form id="vote-form">
      <div class="form-group">
        <label for="voter-name">Your Name</label>
        <input type="text" id="voter-name" placeholder="Enter your name" required>
      </div>

      <div class="form-group">
        <label>Select a Time</label>
        <div class="radio-group">
  `;

  state.options.times.forEach(time => {
    html += `
      <div class="radio-option">
        <input type="radio" id="time-${time.id}" name="time" value="${time.id}" required>
        <label for="time-${time.id}">${escapeHtml(time.label)}</label>
      </div>
    `;
  });

  html += `
        </div>
      </div>

      <div class="form-group">
        <label>Select a Location</label>
        <div class="radio-group">
  `;

  state.options.locations.forEach(location => {
    html += `
      <div class="radio-option">
        <input type="radio" id="location-${location.id}" name="location" value="${location.id}" required>
        <label for="location-${location.id}">${escapeHtml(location.label)}</label>
      </div>
    `;
  });

  html += `
        </div>
      </div>

      <button type="submit" class="btn btn-primary">Submit Vote</button>
      <div id="vote-message"></div>
    </form>
  `;

  section.innerHTML = html;

  // Attach form handler
  document.getElementById('vote-form').addEventListener('submit', handleVoteSubmit);
}

function renderResultsSection(state) {
  const content = document.getElementById('results-content');
  const { timeCounts, locationCounts, totalVoters } = computeTallies(state);

  let html = `
    <div class="total-voters">Total Voters: ${totalVoters}</div>
    <div class="results-grid">
      <div class="results-category">
        <h4>Time Preferences</h4>
  `;

  state.options.times.forEach(time => {
    const count = timeCounts[time.id];
    const percentage = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;

    html += `
      <div class="tally-item">
        <div class="tally-label">${escapeHtml(time.label)}</div>
        <div class="tally-bar">
          <div class="tally-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="tally-count">${count} vote${count !== 1 ? 's' : ''} (${percentage}%)</div>
      </div>
    `;
  });

  html += `
      </div>
      <div class="results-category">
        <h4>Location Preferences</h4>
  `;

  state.options.locations.forEach(location => {
    const count = locationCounts[location.id];
    const percentage = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;

    html += `
      <div class="tally-item">
        <div class="tally-label">${escapeHtml(location.label)}</div>
        <div class="tally-bar">
          <div class="tally-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="tally-count">${count} vote${count !== 1 ? 's' : ''} (${percentage}%)</div>
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  content.innerHTML = html;
}

function renderRSVPSection(state) {
  const section = document.getElementById('rsvp-section');

  if (!state.locked) {
    section.innerHTML = '';
    return;
  }

  let html = `
    <h2>RSVP</h2>
    <form id="rsvp-form">
      <div class="form-group">
        <label for="rsvp-name">Your Name</label>
        <input type="text" id="rsvp-name" placeholder="Enter your name" required>
      </div>

      <div class="rsvp-controls">
        <button type="submit" name="status" value="going" class="btn btn-success">I'm Going</button>
        <button type="submit" name="status" value="notGoing" class="btn btn-danger">Not Going</button>
      </div>

      <div id="rsvp-message"></div>
    </form>

    <div class="attendee-list">
      <h4>Attendees</h4>
  `;

  const going = Object.entries(state.rsvps)
    .filter(([_, rsvp]) => rsvp.status === 'going')
    .map(([name, _]) => name);

  html += `<div class="attendee-count">${going.length} going</div>`;

  if (going.length > 0) {
    html += '<ul>';
    going.forEach(name => {
      html += `<li>${escapeHtml(name)}</li>`;
    });
    html += '</ul>';
  } else {
    html += '<p style="color: #718096; font-style: italic;">No one has confirmed yet</p>';
  }

  html += '</div>';

  section.innerHTML = html;

  // Attach RSVP handlers
  const rsvpForm = document.getElementById('rsvp-form');
  rsvpForm.addEventListener('submit', handleRSVPSubmit);
}

// Event handlers
function handleVoteSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('voter-name').value.trim();
  const timeId = document.querySelector('input[name="time"]:checked')?.value;
  const locationId = document.querySelector('input[name="location"]:checked')?.value;

  const messageDiv = document.getElementById('vote-message');

  if (!name) {
    messageDiv.innerHTML = '<div class="error">Please enter your name</div>';
    return;
  }

  if (!timeId || !locationId) {
    messageDiv.innerHTML = '<div class="error">Please select both a time and location</div>';
    return;
  }

  const state = loadState();
  const normalizedName = normalizeName(name);

  // Store with normalized key but preserve original name for display
  if (!state.votes[normalizedName]) {
    state.votes[normalizedName] = { displayName: name };
  } else {
    state.votes[normalizedName].displayName = name;
  }

  state.votes[normalizedName].timeId = timeId;
  state.votes[normalizedName].locationId = locationId;
  state.votes[normalizedName].updatedAt = Date.now();

  saveState(state);

  messageDiv.innerHTML = `<div class="confirmation">Vote recorded for ${escapeHtml(name)}!</div>`;

  // Re-render results
  renderResultsSection(state);

  // Clear form
  e.target.reset();

  // Clear message after 3 seconds
  setTimeout(() => {
    messageDiv.innerHTML = '';
  }, 3000);
}

function handleRSVPSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('rsvp-name').value.trim();
  const status = e.submitter.value;

  const messageDiv = document.getElementById('rsvp-message');

  if (!name) {
    messageDiv.innerHTML = '<div class="error">Please enter your name</div>';
    return;
  }

  const state = loadState();
  const normalizedName = normalizeName(name);

  state.rsvps[normalizedName] = {
    displayName: name,
    status: status,
    updatedAt: Date.now()
  };

  saveState(state);

  const statusText = status === 'going' ? 'confirmed as going' : 'marked as not going';
  messageDiv.innerHTML = `<div class="confirmation">${escapeHtml(name)} ${statusText}!</div>`;

  // Re-render RSVP section
  renderRSVPSection(state);

  // Clear form
  document.getElementById('rsvp-name').value = '';

  // Clear message after 3 seconds
  setTimeout(() => {
    messageDiv.innerHTML = '';
  }, 3000);
}

function handleLockPlan() {
  const password = document.getElementById('organizer-password').value;
  const errorDiv = document.getElementById('organizer-error');

  if (password !== ORGANIZER_PASSWORD) {
    errorDiv.textContent = 'Incorrect password';
    setTimeout(() => {
      errorDiv.textContent = '';
    }, 3000);
    return;
  }

  const state = loadState();

  if (state.locked) {
    errorDiv.textContent = 'Plan is already locked';
    setTimeout(() => {
      errorDiv.textContent = '';
    }, 3000);
    return;
  }

  const winners = computeWinners(state);

  state.locked = true;
  state.organizer.lockedAt = Date.now();
  state.organizer.lockedTimeId = winners.timeId;
  state.organizer.lockedLocationId = winners.locationId;

  saveState(state);

  // Clear password field
  document.getElementById('organizer-password').value = '';

  // Re-render everything
  render();
}

function handleResetDemo() {
  if (confirm('Are you sure you want to reset the demo? All data will be cleared.')) {
    const freshState = seedState();
    saveState(freshState);
    render();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Initial render
  render();

  // Attach organizer controls
  document.getElementById('lock-btn').addEventListener('click', handleLockPlan);
  document.getElementById('reset-btn').addEventListener('click', handleResetDemo);
});
