const PASSWORD_HASH = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';
const TAG_COLORS = ['#7c8ff1', '#5ec7b6', '#f9a13b', '#c86bb1', '#89b34a', '#57a0e0', '#f07167'];

const state = {
  tagColorMap: new Map(),
  sortable: null,
  advisorsLoaded: false,
  rankListEl: null,
  rankHeaderEl: null,
  tableResizeObserver: null,
};

let rankSyncFrame = null;

document.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('splash');
  const passwordForm = document.getElementById('password-form');
  const passwordInput = document.getElementById('password-input');
  const passwordStatus = document.getElementById('password-status');
  const advisorForm = document.getElementById('advisor-form');
  const emailInput = document.getElementById('email');
  const submitBtn = advisorForm.querySelector('button[type="submit"]');
  state.rankListEl = document.getElementById('rank-table-body');
  state.rankHeaderEl = document.querySelector('.rank-table thead tr');

  attachParallaxBackground();
  enforceColumbiaEmail(emailInput);
  loadAdvisors(submitBtn);
  window.addEventListener('resize', scheduleRankSync);
  window.addEventListener('load', scheduleRankSync);

  passwordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    passwordStatus.textContent = '';

    try {
      const hash = await sha256(passwordInput.value.trim());
      if (hash === PASSWORD_HASH) {
        splash.classList.add('splash--hidden');
        setTimeout(() => splash.remove(), 600);
      } else {
        passwordStatus.textContent = 'That password is incorrect.';
      }
    } catch (error) {
      passwordStatus.textContent = 'Password check failed. Refresh and try again.';
      console.error(error);
    } finally {
      passwordInput.value = '';
    }
  });

  advisorForm.addEventListener('submit', (event) => handleSubmit(event, advisorForm, submitBtn));
});

function attachParallaxBackground() {
  document.addEventListener('pointermove', (event) => {
    const { innerWidth, innerHeight } = window;
    const offsetX = ((event.clientX / innerWidth) - 0.5) * 20;
    const offsetY = ((event.clientY / innerHeight) - 0.5) * 20;
    document.body.style.setProperty('--bg-shift-x', `${offsetX}px`);
    document.body.style.setProperty('--bg-shift-y', `${offsetY}px`);
  });
}

function enforceColumbiaEmail(emailInput) {
  if (!emailInput) return;
  const pattern = /^[^\s@]+@columbia\.edu$/i;
  const message = 'Use your @columbia.edu email address.';

  emailInput.addEventListener('input', () => {
    if (!emailInput.value || pattern.test(emailInput.value.trim())) {
      emailInput.setCustomValidity('');
    } else {
      emailInput.setCustomValidity(message);
    }
  });
}

function loadAdvisors(submitBtn) {
  const tableBody = document.querySelector('#advisor-table tbody');
  const rankList = document.getElementById('rank-table-body');
  const guidanceEls = document.querySelectorAll('.table-guidance');
  const setGuidance = (message) => {
    guidanceEls.forEach((node) => {
      node.textContent = message;
    });
  };
  state.rankListEl = rankList;
  state.rankHeaderEl = document.querySelector('.rank-table thead tr');

  setGuidance('Loading advisors…');
  submitBtn.disabled = true;

  Papa.parse('2026-Capstone-Advisors.csv', {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const data = (results.data || []).filter((row) => row.Name);
      const tagKey = findTagField(results.meta?.fields);

      buildRankList(rankList, data.length);
      tableBody.innerHTML = '';
      data.forEach((row) => {
        const tags = parseTags(row[tagKey]);
        const tr = document.createElement('tr');
        tr.classList.add('advisor-row');
        tr.dataset.name = (row.Name || '').trim();
        tr.dataset.capacity = (row.Capacity || '').trim();
        tr.dataset.tags = tags.join(', ');

        const nameCell = document.createElement('td');
        nameCell.textContent = row.Name || '—';

        const capacityCell = document.createElement('td');
        capacityCell.textContent = row.Capacity || '0';

        const tagsCell = document.createElement('td');
        if (tags.length) {
          tags.forEach((tag) => {
            const pill = document.createElement('span');
            pill.className = 'tag';
            pill.textContent = tag;
            pill.style.backgroundColor = pickTagColor(tag);
            tagsCell.appendChild(pill);
          });
        } else {
          tagsCell.textContent = '—';
        }

        tr.append(nameCell, capacityCell, tagsCell);
        tableBody.appendChild(tr);
      });

      initSortable(tableBody);
      updateChoicesField();
      setGuidance('Drag rows to rank your preferences. Left column shows the choice numbers.');
      state.advisorsLoaded = true;
      submitBtn.disabled = false;
      observeTableSize(document.getElementById('advisor-table'));
    },
    error: (error) => {
      console.error(error);
      setGuidance('Could not load advisors. Please reload the page.');
    },
  });
}

function findTagField(fields = []) {
  return (
    fields.find((field) => field.toLowerCase().includes('methods')) ||
    fields[2] ||
    'Tags'
  );
}

function parseTags(raw = '') {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function pickTagColor(tag) {
  if (!state.tagColorMap.has(tag)) {
    const index = state.tagColorMap.size % TAG_COLORS.length;
    state.tagColorMap.set(tag, TAG_COLORS[index]);
  }
  return state.tagColorMap.get(tag);
}

function buildRankList(listEl, count) {
  if (!listEl) return;
  state.rankListEl = listEl;
  listEl.innerHTML = '';
  const fragment = document.createDocumentFragment();
  for (let i = 1; i <= count; i += 1) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.textContent = `${ordinal(i)} Choice`;
    tr.appendChild(td);
    fragment.appendChild(tr);
  }
  listEl.appendChild(fragment);
  scheduleRankSync();
}

function initSortable(tbody) {
  if (!tbody) return;
  if (state.sortable) {
    state.sortable.destroy();
  }

  state.sortable = new Sortable(tbody, {
    animation: 180,
    handle: 'tr',
    ghostClass: 'dragging',
    onStart: (evt) => evt.item.classList.add('dragging'),
    onEnd: (evt) => {
      evt.item.classList.remove('dragging');
      updateChoicesField();
    },
  });
}

function updateChoicesField() {
  const choicesInput = document.getElementById('choices');
  const tbody = document.querySelector('#advisor-table tbody');
  if (!choicesInput || !tbody) return;

  const records = Array.from(tbody.querySelectorAll('tr')).map((row, index) => ({
    rank: `${ordinal(index + 1)} Choice`,
    advisor: row.dataset.name || '',
    capacity: row.dataset.capacity || '',
    tags: row.dataset.tags || '',
  }));

  choicesInput.value = serializeChoicesToCSV(records);
  scheduleRankSync();
}

function serializeChoicesToCSV(rows) {
  const header = 'Rank,Advisor,Capacity,Tags';
  const body = rows
    .map((row) => [row.rank, row.advisor, row.capacity, row.tags]
      .map((value) => escapeCsv(value))
      .join(','))
    .join('\n');
  return `${header}\n${body}`;
}

function escapeCsv(value = '') {
  if (value === null || value === undefined) return '';
  const needsQuotes = /[",\n]/.test(value);
  const sanitized = value.replace(/"/g, '""');
  return needsQuotes ? `"${sanitized}"` : sanitized;
}

function ordinal(value) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

async function handleSubmit(event, form, submitBtn) {
  event.preventDefault();

  const formStatus = document.getElementById('form-status');
  if (!state.advisorsLoaded) {
    setFormStatus(formStatus, 'Please wait for the advisor list to load.', 'error');
    return;
  }

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  submitBtn.disabled = true;
  updateChoicesField();

  const choicesInput = document.getElementById('choices');
  const csvPayload = choicesInput.value;
  const emailValue = (form.querySelector('#email').value || '').trim().toLowerCase();

  triggerCsvDownload(csvPayload, emailValue);

  const formData = new FormData(form);
  setFormStatus(formStatus, 'Submitting to Netlify…', 'pending');

  try {
    const response = await fetch('/', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Netlify returned ${response.status}`);
    }

    setFormStatus(formStatus, 'Thanks! Your rankings were sent successfully.', 'success');
    form.reset();
    updateChoicesField();
  } catch (error) {
    console.error(error);
    setFormStatus(
      formStatus,
      'Your CSV was saved locally, but the online submission failed here. Try again once deployed.',
      'error',
    );
  } finally {
    submitBtn.disabled = false;
  }
}

function triggerCsvDownload(csv, email = '') {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const safeEmail = email.replace(/[^a-z0-9@._-]/gi, '-');
  link.download = `advisor-choices-${safeEmail || 'student'}.csv`;
  link.href = URL.createObjectURL(blob);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    link.remove();
  }, 100);
}

function setFormStatus(node, message, variant) {
  if (!node) return;
  node.textContent = message;
  node.classList.remove('form-status--success', 'form-status--error');
  if (variant === 'success') node.classList.add('form-status--success');
  if (variant === 'error') node.classList.add('form-status--error');
}

function observeTableSize(target) {
  if (typeof ResizeObserver === 'undefined') return;
  if (!target) return;
  if (state.tableResizeObserver) {
    state.tableResizeObserver.disconnect();
  }
  state.tableResizeObserver = new ResizeObserver(() => scheduleRankSync());
  state.tableResizeObserver.observe(target);
}

function scheduleRankSync() {
  if (rankSyncFrame) {
    cancelAnimationFrame(rankSyncFrame);
  }
  rankSyncFrame = requestAnimationFrame(syncRankHeights);
}

function syncRankHeights() {
  rankSyncFrame = null;
  const rankList = state.rankListEl || document.getElementById('rank-table-body');
  const rankHeader = state.rankHeaderEl || document.querySelector('.rank-table thead tr');
  state.rankHeaderEl = rankHeader;
  const advisorTable = document.getElementById('advisor-table');
  const advisorHeaderRow = advisorTable?.querySelector('thead tr');
  if (rankHeader && advisorHeaderRow) {
    const { height } = advisorHeaderRow.getBoundingClientRect();
    if (height > 0) {
      rankHeader.style.height = `${height}px`;
    }
  } else if (rankHeader) {
    rankHeader.style.removeProperty('height');
  }
  if (!rankList) return;
  state.rankListEl = rankList;
  const rankRows = rankList.querySelectorAll('tr');
  const rows = document.querySelectorAll('#advisor-table tbody tr');
  rankRows.forEach((rankRow, index) => {
    const dataRow = rows[index];
    if (!dataRow) {
      rankRow.style.height = '0px';
      return;
    }
    const { height } = dataRow.getBoundingClientRect();
    rankRow.style.height = `${height}px`;
    const cell = rankRow.firstElementChild;
    if (cell) {
      cell.style.height = `${height}px`;
    }
  });
}

async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
