const PASSWORD_HASH = '566ffcee658ba582e08468f0f1634411bed916f4d29644be41b0b6575771c05d';
const TAG_COLORS = [
  'rgba(124, 143, 241, 0.25)',
  'rgba(94, 199, 182, 0.25)',
  'rgba(249, 161, 59, 0.25)',
  'rgba(200, 107, 177, 0.25)',
  'rgba(137, 179, 74, 0.25)',
  'rgba(87, 160, 224, 0.25)',
  'rgba(240, 113, 103, 0.25)',
];

const ORDER_STORAGE_KEY = 'advisor-order-2026';

const state = {
  tagColorMap: new Map(),
  sortable: null,
  advisorsLoaded: false,
  choiceFieldContainer: null,
  tooltipTimer: null,
};

document.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('splash');
  const passwordForm = document.getElementById('password-form');
  const passwordInput = document.getElementById('password-input');
  const passwordStatus = document.getElementById('password-status');
  const advisorForm = document.getElementById('advisor-form');
  const emailInput = document.getElementById('email');
  const choiceFields = document.getElementById('choice-fields');
  const submitBtn = advisorForm.querySelector('button[type="submit"]');
  state.choiceFieldContainer = choiceFields;

  attachParallaxBackground();
  enforceColumbiaEmail(emailInput);
  loadAdvisors(submitBtn);
  setupDragTooltip();

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
  const guidanceEls = document.querySelectorAll('.table-guidance');
  const setGuidance = (message) => {
    guidanceEls.forEach((node) => {
      node.textContent = message;
    });
  };

  setGuidance('Loading advisors…');
  submitBtn.disabled = true;

  Papa.parse('2026-Capstone-Advisors.csv', {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const rawData = (results.data || []).filter((row) => row.Name);
      const tagKey = findTagField(results.meta?.fields);
      const normalized = rawData.map((row) => ({
        ...row,
        __name: (row.Name || '').trim(),
      }));

      const orderedRows = applyInitialOrder(normalized);

      tableBody.innerHTML = '';
      orderedRows.forEach((row) => {
        const tags = parseTags(row[tagKey]);
        const tr = document.createElement('tr');
        tr.classList.add('advisor-row');
        tr.dataset.name = row.__name;
        tr.dataset.capacity = (row.Capacity || '').trim();
        tr.dataset.tags = tags.join(', ');

        const rankCell = document.createElement('td');
        rankCell.className = 'rank-cell';

        const nameCell = document.createElement('td');
        nameCell.textContent = row.__name || '—';

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

        tr.append(rankCell, nameCell, capacityCell, tagsCell);
        tableBody.appendChild(tr);
      });

      initSortable(tableBody);
      updateRankNumbers();
      const initialOrder = updateChoiceFields();
      saveCurrentOrder(initialOrder);
      setGuidance('Drag rows to rank your preferences. Left column shows the choice numbers.');
      state.advisorsLoaded = true;
      submitBtn.disabled = false;
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

function applyInitialOrder(rows) {
  const expectedNames = rows.map((row) => row.__name);
  const storedOrder = loadSavedOrder(expectedNames);
  const working = rows.slice();
  if (storedOrder) {
    working.sort((a, b) => storedOrder.indexOf(a.__name) - storedOrder.indexOf(b.__name));
  } else {
    shuffleArray(working);
  }
  return working;
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
      updateRankNumbers();
      const currentOrder = updateChoiceFields();
      saveCurrentOrder(currentOrder);
      flashRow(evt.item);
    },
  });
}

function updateChoiceFields() {
  const names = getOrderedAdvisorNames();
  syncChoiceInputs(names);
  return names;
}

function getOrderedAdvisorNames() {
  const tbody = document.querySelector('#advisor-table tbody');
  if (!tbody) return [];
  return Array.from(tbody.querySelectorAll('tr')).map((row) => row.dataset.name || '');
}

function syncChoiceInputs(names) {
  const container = state.choiceFieldContainer || document.getElementById('choice-fields');
  if (!container) return;
  state.choiceFieldContainer = container;
  const inputs = Array.from(container.querySelectorAll('input[name$="Choice"]'));
  inputs.forEach((input, index) => {
    input.value = names[index] || '';
  });
  if (names.length > inputs.length) {
    console.warn(`Only the first ${inputs.length} choices can be submitted to Netlify. Additional choices are saved locally.`);
  }
}

function updateRankNumbers() {
  const rows = document.querySelectorAll('#advisor-table tbody tr');
  rows.forEach((row, index) => {
    const rankCell = row.querySelector('.rank-cell');
    if (rankCell) {
      rankCell.textContent = index + 1;
    }
  });
}

function flashRow(row) {
  if (!row) return;
  row.classList.add('reordered');
  setTimeout(() => row.classList.remove('reordered'), 600);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function loadSavedOrder(expectedNames) {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (parsed.length !== expectedNames.length) return null;
    const expectedSet = new Set(expectedNames);
    const matches = parsed.every((name) => expectedSet.has(name));
    return matches ? parsed : null;
  } catch (error) {
    console.warn('Could not read stored advisor order.', error);
    return null;
  }
}

function saveCurrentOrder(order) {
  if (!Array.isArray(order) || !order.length) return;
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch (error) {
    console.warn('Could not persist advisor order.', error);
  }
}

function buildStudentCsv(name, email, choices) {
  const headers = ['Name', 'Email', ...choices.map((_, index) => `${ordinal(index + 1)} Choice`)];
  const values = [name, email, ...choices];
  const headerRow = headers.map((value) => escapeCsv(value)).join(',');
  const valueRow = values.map((value) => escapeCsv(value)).join(',');
  return `${headerRow}\n${valueRow}`;
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
  const choiceNames = updateChoiceFields();

  const nameValue = (form.querySelector('#full-name').value || '').trim();
  const emailValue = (form.querySelector('#email').value || '').trim().toLowerCase();
  const csvPayload = buildStudentCsv(nameValue, emailValue, choiceNames);

  triggerCsvDownload(csvPayload, emailValue);

  const formData = new FormData(form);
  formData.set('form-name', 'advisor-lottery');
  formData.set('Name', nameValue);
  formData.set('Email', emailValue);
  const choiceInputs = state.choiceFieldContainer
    ? Array.from(state.choiceFieldContainer.querySelectorAll('input[name$="Choice"]'))
    : [];
  choiceInputs.forEach((input) => {
    formData.set(input.name, input.value || '');
  });
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
    const refreshedOrder = updateChoiceFields();
    saveCurrentOrder(refreshedOrder);
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

function setupDragTooltip() {
  const tooltip = document.getElementById('drag-tooltip');
  const tableWrapper = document.querySelector('.choices__table .table-wrapper');
  if (!tooltip || !tableWrapper) return;

  let hideTimer = null;
  const hideDuration = 2000;

  const positionTooltip = (event) => {
    const rect = tableWrapper.getBoundingClientRect();
    const offsetX = 8;
    const offsetY = 12;
    let x = event.clientX - rect.left + offsetX;
    let y = event.clientY - rect.top + offsetY;

    const maxX = rect.width - tooltip.offsetWidth - 8;
    const maxY = rect.height - tooltip.offsetHeight - 8;
    x = Math.max(8, Math.min(x, maxX));
    y = Math.max(8, Math.min(y, maxY));

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  };

  const showTooltip = (event) => {
    positionTooltip(event);
    tooltip.classList.add('drag-tooltip--visible');
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => tooltip.classList.remove('drag-tooltip--visible'), hideDuration);
  };

  const handleMove = (event) => {
    if (!tooltip.classList.contains('drag-tooltip--visible')) return;
    positionTooltip(event);
  };

  const hideTooltip = () => {
    tooltip.classList.remove('drag-tooltip--visible');
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  tableWrapper.addEventListener('mouseenter', showTooltip);
  tableWrapper.addEventListener('focusin', showTooltip);
  tableWrapper.addEventListener('mousemove', handleMove);
  tableWrapper.addEventListener('mouseleave', hideTooltip);
  tableWrapper.addEventListener('focusout', hideTooltip);
}

async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
