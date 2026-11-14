// Pincha Space - Frontend Client Script

let allDates = [];
let currentFilter = 'all';
let searchQuery = '';
let countdownInterval = null;
let selectedFiles = [];

// DOM Elements
const datesGrid = document.getElementById('datesGrid');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');

// Hero elements
const nextDateTitle = document.getElementById('nextDateTitle');
const nextDateDate = document.getElementById('nextDateDate');
const nextDateTime = document.getElementById('nextDateTime');
const nextDateLocation = document.getElementById('nextDateLocation');
const cdDays = document.getElementById('cdDays');
const cdHours = document.getElementById('cdHours');
const cdMinutes = document.getElementById('cdMinutes');
const cdSeconds = document.getElementById('cdSeconds');

// Stat elements
const statTotal = document.getElementById('statTotal');
const statUpcoming = document.getElementById('statUpcoming');
const statCompleted = document.getElementById('statCompleted');
const statPhotos = document.getElementById('statPhotos');

// Modals
const modalDateForm = document.getElementById('modalDateForm');
const modalUploadPhotos = document.getElementById('modalUploadPhotos');
const modalLightbox = document.getElementById('modalLightbox');

// Forms & Inputs
const dateForm = document.getElementById('dateForm');
const editDateId = document.getElementById('editDateId');
const modalDateTitle = document.getElementById('modalDateTitle');
const formTitle = document.getElementById('formTitle');
const formDate = document.getElementById('formDate');
const formTime = document.getElementById('formTime');
const formLocation = document.getElementById('formLocation');
const formLocationMapUrl = document.getElementById('formLocationMapUrl');
const formDressCode = document.getElementById('formDressCode');
const formNotes = document.getElementById('formNotes');
const activityRowsContainer = document.getElementById('activityRowsContainer');
const btnAddActivityRow = document.getElementById('btnAddActivityRow');

// Upload form inputs
const uploadPhotosForm = document.getElementById('uploadPhotosForm');
const uploadDateId = document.getElementById('uploadDateId');
const uploadModalSubtitle = document.getElementById('uploadModalSubtitle');
const dropzone = document.getElementById('dropzone');
const photoFilesInput = document.getElementById('photoFilesInput');
const selectedPhotosPreview = document.getElementById('selectedPhotosPreview');
const starRatingContainer = document.getElementById('starRatingContainer');
const starRatingLabel = document.getElementById('starRatingLabel');
const ratingInput = document.getElementById('ratingInput');
const reviewHighlight = document.getElementById('reviewHighlight');

// Lightbox elements
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxDate = document.getElementById('lightboxDate');

// ======================== INITIALIZATION ========================

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadDates();
  initIcons();
});

function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function initEventListeners() {
  // Navigation & buttons
  document.getElementById('btnOpenCreateDate').addEventListener('click', () => openCreateModal());
  document.getElementById('btnCloseDateModal').addEventListener('click', closeDateModal);
  document.getElementById('btnCancelDateForm').addEventListener('click', closeDateModal);
  document.getElementById('btnCloseUploadModal').addEventListener('click', closeUploadModal);
  document.getElementById('btnCancelUpload').addEventListener('click', closeUploadModal);
  document.getElementById('btnCloseLightbox').addEventListener('click', closeLightbox);

  // Close modals on clicking backdrop
  [modalDateForm, modalUploadPhotos, modalLightbox].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    });
  });

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => {
        t.classList.remove('text-rose-600', 'bg-white', 'shadow-sm');
        t.classList.add('text-slate-600');
      });
      tab.classList.add('text-rose-600', 'bg-white', 'shadow-sm');
      tab.classList.remove('text-slate-600');

      currentFilter = tab.dataset.filter;
      renderDates();
    });
  });

  // Search input
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderDates();
  });

  // Add activity row in form
  btnAddActivityRow.addEventListener('click', () => addActivityRow());

  // Form submit: Create / Edit Date
  dateForm.addEventListener('submit', handleDateFormSubmit);

  // Date and Time restrictions: prevent selecting past date & time
  formDate.addEventListener('input', updateDateTimeRestrictions);
  formDate.addEventListener('change', updateDateTimeRestrictions);
  formTime.addEventListener('input', updateDateTimeRestrictions);
  formTime.addEventListener('change', updateDateTimeRestrictions);

  // Star rating selector
  initStarRating();

  // Dropzone file upload handling
  initDropzone();

  // Upload Form submit
  uploadPhotosForm.addEventListener('submit', handleUploadSubmit);
}

// ======================== FETCH & DATA ========================

async function loadDates() {
  try {
    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    datesGrid.innerHTML = '';

    const res = await fetch('/api/dates');
    const json = await res.json();
    if (json.success) {
      allDates = json.data;
      if (allDates.length > 0) {
        try { localStorage.setItem('pincha_dates_backup', JSON.stringify(allDates)); } catch (e) {}
      } else {
        const cached = localStorage.getItem('pincha_dates_backup');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              allDates = parsed;
            }
          } catch (e) {}
        }
      }
      updateStats();
      updateHeroCountdown();
      renderDates();
    }
  } catch (err) {
    console.error('Error fetching dates:', err);
    Swal.fire({
      icon: 'error',
      title: 'Oops!',
      text: 'Gagal mengambil data jadwal date.'
    });
  } finally {
    loadingState.classList.add('hidden');
  }
}

function updateStats() {
  const total = allDates.length;
  const upcoming = allDates.filter(d => d.status === 'upcoming').length;
  const completed = allDates.filter(d => d.status === 'completed').length;
  const totalPhotos = allDates.reduce((acc, d) => acc + (d.photos ? d.photos.length : 0), 0);

  statTotal.textContent = total;
  statUpcoming.textContent = upcoming;
  statCompleted.textContent = completed;
  statPhotos.textContent = totalPhotos;
}

// ======================== HERO COUNTDOWN ========================

function updateHeroCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  // Find nearest upcoming date
  const now = new Date();
  const upcomingDates = allDates
    .filter(d => d.status === 'upcoming')
    .map(d => {
      const dt = new Date(`${d.date}T${d.time || '00:00'}`);
      return { ...d, dateTimeObj: dt };
    })
    .sort((a, b) => a.dateTimeObj - b.dateTimeObj);

  if (upcomingDates.length === 0) {
    nextDateTitle.textContent = "Belum ada rencana kencan mendatang 💕";
    nextDateDate.textContent = "Klik 'Buat Jadwal Date'";
    nextDateTime.textContent = "Bikin harimu istimewa";
    nextDateLocation.textContent = "Pilih tempat favorit kalian";
    cdDays.textContent = "00";
    cdHours.textContent = "00";
    cdMinutes.textContent = "00";
    cdSeconds.textContent = "00";
    return;
  }

  const targetDate = upcomingDates[0];
  nextDateTitle.textContent = targetDate.title;
  nextDateDate.textContent = formatIndoDate(targetDate.date);
  nextDateTime.textContent = `${targetDate.time} WIB`;
  nextDateLocation.textContent = targetDate.location;

  function tick() {
    const current = new Date();
    const diff = targetDate.dateTimeObj - current;

    if (diff <= 0) {
      cdDays.textContent = "00";
      cdHours.textContent = "00";
      cdMinutes.textContent = "00";
      cdSeconds.textContent = "00";
      nextDateTitle.textContent = `Hari Kencan Telah Tiba! ✨ "${targetDate.title}"`;
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    cdDays.textContent = String(days).padStart(2, '0');
    cdHours.textContent = String(hours).padStart(2, '0');
    cdMinutes.textContent = String(minutes).padStart(2, '0');
    cdSeconds.textContent = String(seconds).padStart(2, '0');
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

// ======================== RENDER CARDS ========================

function renderDates() {
  let filtered = allDates;

  // Filter by tab
  if (currentFilter === 'upcoming') {
    filtered = filtered.filter(d => d.status === 'upcoming');
  } else if (currentFilter === 'completed') {
    filtered = filtered.filter(d => d.status === 'completed');
  }

  // Filter by search query
  if (searchQuery) {
    filtered = filtered.filter(d => 
      d.title.toLowerCase().includes(searchQuery) ||
      d.location.toLowerCase().includes(searchQuery) ||
      (d.notes && d.notes.toLowerCase().includes(searchQuery)) ||
      (d.activities && d.activities.some(a => a.task.toLowerCase().includes(searchQuery)))
    );
  }

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    datesGrid.innerHTML = '';
    return;
  }

  emptyState.classList.add('hidden');
  datesGrid.innerHTML = filtered.map(d => renderSingleDateCard(d)).join('');
  initIcons();
}

function renderSingleDateCard(dateItem) {
  const isCompleted = dateItem.status === 'completed';
  const statusBadge = isCompleted 
    ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><i data-lucide="check-check" class="w-3.5 h-3.5"></i> Selesai & Berkesan</span>`
    : `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><i data-lucide="clock" class="w-3.5 h-3.5"></i> Akan Datang</span>`;

  // Format date
  const formattedDate = formatIndoDate(dateItem.date);

  // Activities Checklist HTML
  let activitiesHtml = '';
  if (dateItem.activities && dateItem.activities.length > 0) {
    activitiesHtml = `
      <div class="mt-4 pt-3 border-t border-slate-100">
        <p class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span class="flex items-center gap-1.5">
            <i data-lucide="list-checks" class="w-4 h-4 text-rose-500"></i>
            Rencana Kegiatan ("Ngapain Aja"):
          </span>
          <span class="text-[11px] font-normal text-slate-400">Centang saat selesai</span>
        </p>
        <div class="space-y-1.5">
          ${dateItem.activities.map(act => `
            <div class="flex items-start gap-2.5 text-xs text-slate-600 group py-0.5">
              <input type="checkbox" ${act.done ? 'checked' : ''} 
                onchange="toggleActivity('${dateItem.id}', '${act.id}')"
                class="mt-0.5 rounded text-rose-500 focus:ring-rose-400 cursor-pointer">
              <span class="font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap">${act.time || '•'}</span>
              <span class="${act.done ? 'line-through text-slate-400' : 'text-slate-700'}">${escapeHtml(act.task)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Review / Memory Stories HTML
  let reviewHtml = '';
  if (isCompleted && dateItem.review) {
    const stars = '★'.repeat(dateItem.review.rating || 5) + '☆'.repeat(5 - (dateItem.review.rating || 5));
    reviewHtml = `
      <div class="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-100/70">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-amber-500 text-sm tracking-wider font-bold">${stars}</span>
          <span class="text-[11px] font-semibold text-rose-600 uppercase">Kenangan Kencan</span>
        </div>
        ${dateItem.review.highlight ? `<p class="text-xs text-slate-700 italic font-medium">"${escapeHtml(dateItem.review.highlight)}"</p>` : ''}
      </div>
    `;
  }

  // Photos Gallery HTML
  let photosHtml = '';
  if (dateItem.photos && dateItem.photos.length > 0) {
    photosHtml = `
      <div class="mt-4 pt-3 border-t border-slate-100">
        <div class="flex items-center justify-between mb-2">
          <p class="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <i data-lucide="images" class="w-4 h-4 text-pink-500"></i>
            Galeri Foto Kencan (${dateItem.photos.length})
          </p>
          <button onclick="openUploadModal('${dateItem.id}')" class="text-[11px] text-rose-600 font-semibold hover:underline flex items-center gap-1">
            <i data-lucide="plus" class="w-3 h-3"></i> Tambah Foto
          </button>
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
          ${dateItem.photos.map(p => `
            <div class="relative group aspect-square rounded-xl overflow-hidden bg-slate-100 shadow-sm border border-slate-200">
              <img src="${p.url}" alt="${p.caption || 'Foto Date'}" class="w-full h-full object-cover transition duration-300 group-hover:scale-105 cursor-pointer" onclick="openLightbox('${p.url}', '${escapeHtml(p.caption || '')}', '${formatIndoDate(dateItem.date)}')">
              <button onclick="deletePhoto('${dateItem.id}', '${p.id}')" title="Hapus foto" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-rose-600">
                <i data-lucide="trash-2" class="w-3 h-3"></i>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div class="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition space-y-3 flex flex-col justify-between">
      <div>
        <!-- Top Header: Status & Actions -->
        <div class="flex items-center justify-between gap-2 mb-2">
          ${statusBadge}
          <div class="flex items-center gap-1">
            <button onclick="editDate('${dateItem.id}')" title="Edit Jadwal" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteDate('${dateItem.id}')" title="Hapus Jadwal" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Date Title -->
        <h3 class="text-lg font-bold text-slate-800 leading-snug">
          ${escapeHtml(dateItem.title)}
        </h3>

        <!-- Date, Time & Location -->
        <div class="mt-2 space-y-1.5 text-xs text-slate-600">
          <div class="flex items-center gap-2">
            <i data-lucide="calendar" class="w-4 h-4 text-rose-500 shrink-0"></i>
            <span class="font-medium text-slate-700">${formattedDate}</span>
            <span class="text-slate-300">•</span>
            <i data-lucide="clock" class="w-4 h-4 text-rose-500 shrink-0"></i>
            <span class="font-semibold text-slate-700">${dateItem.time} WIB</span>
          </div>

          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 truncate">
              <i data-lucide="map-pin" class="w-4 h-4 text-rose-500 shrink-0"></i>
              <span class="truncate font-medium text-slate-700">${escapeHtml(dateItem.location)}</span>
            </div>
            ${dateItem.locationMapUrl ? `
              <a href="${dateItem.locationMapUrl}" target="_blank" rel="noopener noreferrer" class="shrink-0 text-rose-600 font-semibold hover:underline inline-flex items-center gap-1 text-[11px] bg-rose-50 px-2 py-0.5 rounded-md">
                <span>Maps</span> <i data-lucide="external-link" class="w-3 h-3"></i>
              </a>
            ` : ''}
          </div>
        </div>

        <!-- Dresscode Tag -->
        ${dateItem.dressCode ? `
          <div class="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-slate-100 text-[11px]">
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
              <i data-lucide="shirt" class="w-3 h-3 text-slate-500"></i> ${escapeHtml(dateItem.dressCode)}
            </span>
          </div>
        ` : ''}

        <!-- Notes -->
        ${dateItem.notes ? `
          <div class="mt-3 p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-xs text-amber-800 flex items-start gap-2">
            <i data-lucide="sticky-note" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"></i>
            <p class="leading-relaxed">${escapeHtml(dateItem.notes)}</p>
          </div>
        ` : ''}

        <!-- Activities / Itinerary Checklist -->
        ${activitiesHtml}

        <!-- Review / Memory quote -->
        ${reviewHtml}

        <!-- Photo gallery -->
        ${photosHtml}
      </div>

      <!-- Action Button at Bottom -->
      <div class="mt-4 pt-3 border-t border-slate-100">
        ${!isCompleted ? `
          <button onclick="openUploadModal('${dateItem.id}')" class="w-full py-2.5 px-4 rounded-xl text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shadow-rose-200">
            <i data-lucide="camera" class="w-4 h-4"></i>
            <span>Tandai Selesai & Upload Foto Kenangan</span>
          </button>
        ` : `
          <button onclick="openUploadModal('${dateItem.id}')" class="w-full py-2.5 px-4 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition flex items-center justify-center gap-2">
            <i data-lucide="image-plus" class="w-4 h-4"></i>
            <span>Upload Foto Baru / Update Cerita</span>
          </button>
        `}
      </div>
    </div>
  `;
}

// ======================== ACTIVITIES CHECKLIST ========================

async function toggleActivity(dateId, activityId) {
  try {
    const res = await fetch(`/api/dates/${dateId}/activities/${activityId}/toggle`, {
      method: 'PATCH'
    });
    const json = await res.json();
    if (json.success) {
      // Update local item
      const idx = allDates.findIndex(d => d.id === dateId);
      if (idx !== -1) {
        allDates[idx] = json.data;
        renderDates();
      }
    }
  } catch (err) {
    console.error('Error toggling activity:', err);
  }
}

// ======================== MODAL: CREATE / EDIT DATE ========================

function getLocalTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalCurrentTimeString() {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function updateDateTimeRestrictions() {
  const todayStr = getLocalTodayDateString();
  const currentTimeStr = getLocalCurrentTimeString();

  // Tanggal minimal adalah hari ini (hari kemarin/berlalu tidak bisa dipilih)
  formDate.min = todayStr;

  // Jika tanggal yang dipilih adalah hari ini, jam minimal adalah jam saat ini
  if (formDate.value === todayStr) {
    formTime.min = currentTimeStr;
    if (formTime.value && formTime.value < currentTimeStr) {
      formTime.value = currentTimeStr;
    }
  } else {
    formTime.removeAttribute('min');
  }
}

function openCreateModal() {
  editDateId.value = '';
  modalDateTitle.textContent = 'Buat Jadwal Date Baru';
  dateForm.reset();

  const todayStr = getLocalTodayDateString();
  const now = new Date();

  // Jika hari sudah larut malam (misal >= 21:00), default ke besok jam 16:00
  if (now.getHours() >= 21) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yr = tomorrow.getFullYear();
    const mo = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const da = String(tomorrow.getDate()).padStart(2, '0');
    formDate.value = `${yr}-${mo}-${da}`;
    formTime.value = '16:00';
  } else {
    formDate.value = todayStr;
    // Set jam 1 jam ke depan
    const nextHour = String(Math.min(23, now.getHours() + 1)).padStart(2, '0');
    formTime.value = `${nextHour}:00`;
  }

  updateDateTimeRestrictions();

  // Clear & populate default activity rows
  activityRowsContainer.innerHTML = '';
  addActivityRow(formTime.value, 'Jemput ayang di rumah');
  addActivityRow('', 'Ngopi santai & ngobrol');
  addActivityRow('', 'Makan bareng berdua');

  modalDateForm.classList.remove('hidden');
  modalDateForm.classList.add('flex');
  initIcons();
}

function editDate(id) {
  const item = allDates.find(d => d.id === id);
  if (!item) return;

  editDateId.value = item.id;
  modalDateTitle.textContent = 'Edit Jadwal Date';
  formTitle.value = item.title;
  formDate.value = item.date;
  formTime.value = item.time;
  formLocation.value = item.location;
  formLocationMapUrl.value = item.locationMapUrl || '';
  formDressCode.value = item.dressCode || '';
  formNotes.value = item.notes || '';

  updateDateTimeRestrictions();

  // Populate activities
  activityRowsContainer.innerHTML = '';
  if (item.activities && item.activities.length > 0) {
    item.activities.forEach(a => addActivityRow(a.time, a.task, a.done, a.id));
  } else {
    addActivityRow(item.time, 'Jemput & jalan bareng');
  }

  modalDateForm.classList.remove('hidden');
  modalDateForm.classList.add('flex');
  initIcons();
}

function closeDateModal() {
  modalDateForm.classList.add('hidden');
  modalDateForm.classList.remove('flex');
}

function addActivityRow(time = '', task = '', done = false, id = null) {
  const rowId = id || 'act_' + Math.random().toString(36).substr(2, 9);
  const div = document.createElement('div');
  div.className = 'flex items-center gap-2 activity-row';
  div.dataset.id = rowId;
  div.dataset.done = done ? 'true' : 'false';

  div.innerHTML = `
    <input type="time" class="activity-time w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-rose-400" value="${time}">
    <input type="text" placeholder="Kegiatan, misal: Makan es krim bareng" class="activity-task flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-rose-400" value="${escapeHtml(task)}">
    <button type="button" class="btn-delete-activity text-slate-400 hover:text-red-500 p-1.5 transition">
      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
    </button>
  `;

  div.querySelector('.btn-delete-activity').addEventListener('click', () => {
    div.remove();
  });

  activityRowsContainer.appendChild(div);
  initIcons();
}

async function handleDateFormSubmit(e) {
  e.preventDefault();

  const id = editDateId.value;
  const isEditing = Boolean(id);

  // Validasi agar tanggal dan jam tidak boleh yang sudah berlalu
  const selectedDateVal = formDate.value;
  const selectedTimeVal = formTime.value;
  const selectedDateTime = new Date(`${selectedDateVal}T${selectedTimeVal}`);
  const now = new Date();

  // Berikan toleransi 1 menit jika user sedang mengetik
  if (selectedDateTime.getTime() < now.getTime() - 60000) {
    Swal.fire({
      icon: 'warning',
      title: 'Waktu Tidak Valid',
      text: 'Tanggal dan jam kencan tidak boleh waktu yang telah berlalu! Silakan pilih hari atau jam yang akan datang.',
      confirmButtonColor: '#f43f5e'
    });
    updateDateTimeRestrictions();
    return;
  }

  // Extract activities
  const rows = activityRowsContainer.querySelectorAll('.activity-row');
  const activities = [];
  rows.forEach(r => {
    const timeVal = r.querySelector('.activity-time').value;
    const taskVal = r.querySelector('.activity-task').value.trim();
    const isDone = r.dataset.done === 'true';
    if (taskVal) {
      activities.push({
        id: r.dataset.id,
        time: timeVal,
        task: taskVal,
        done: isDone
      });
    }
  });

  const payload = {
    title: formTitle.value.trim(),
    date: formDate.value,
    time: formTime.value,
    location: formLocation.value.trim(),
    locationMapUrl: formLocationMapUrl.value.trim(),
    dressCode: formDressCode.value.trim(),
    notes: formNotes.value.trim(),
    activities
  };

  try {
    const url = isEditing ? `/api/dates/${id}` : '/api/dates';
    const method = isEditing ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!json.success) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: json.message });
      return;
    }

    closeDateModal();
    await loadDates();

    if (!isEditing) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    }

    Swal.fire({
      icon: 'success',
      title: isEditing ? 'Berhasil Diperbarui!' : 'Jadwal Date Siap! 💕',
      text: json.message,
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    console.error('Error saving date:', err);
    Swal.fire({ icon: 'error', title: 'Error', text: 'Terjadi kesalahan sistem.' });
  }
}

async function deleteDate(id) {
  const item = allDates.find(d => d.id === id);
  if (!item) return;

  const result = await Swal.fire({
    title: 'Hapus Jadwal Ini?',
    text: `Yakin ingin menghapus kencan "${item.title}"?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#f43f5e',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal'
  });

  if (result.isConfirmed) {
    try {
      const res = await fetch(`/api/dates/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        await loadDates();
        Swal.fire({
          icon: 'success',
          title: 'Terhapus',
          text: json.message,
          timer: 1500,
          showConfirmButton: false
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal menghapus jadwal.' });
    }
  }
}

// ======================== MODAL: UPLOAD PHOTOS & MEMORIES ========================

function openUploadModal(dateId) {
  const item = allDates.find(d => d.id === dateId);
  if (!item) return;

  uploadDateId.value = item.id;
  uploadModalSubtitle.textContent = `Kencan: "${item.title}" (${formatIndoDate(item.date)})`;

  // Pre-fill existing review if any
  if (item.review) {
    setStarRating(item.review.rating || 5);
    reviewHighlight.value = item.review.highlight || '';
  } else {
    setStarRating(5);
    reviewHighlight.value = '';
  }

  // Clear preview and input
  selectedFiles = [];
  photoFilesInput.value = '';
  selectedPhotosPreview.innerHTML = '';

  modalUploadPhotos.classList.remove('hidden');
  modalUploadPhotos.classList.add('flex');
  initIcons();
}

function closeUploadModal() {
  modalUploadPhotos.classList.add('hidden');
  modalUploadPhotos.classList.remove('flex');
}

function initStarRating() {
  const starButtons = starRatingContainer.querySelectorAll('.star-btn');
  const labels = {
    1: 'Kurang Berkesan (1/5)',
    2: 'Biasa Saja (2/5)',
    3: 'Lumayan Menyenangkan (3/5)',
    4: 'Sangat Seru & Romantis! (4/5)',
    5: 'Sempurna & Sangat Romantis! (5/5)'
  };

  starButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.dataset.val);
      setStarRating(val);
    });
  });
}

function setStarRating(rating) {
  ratingInput.value = rating;
  const starButtons = starRatingContainer.querySelectorAll('.star-btn');
  const labels = {
    1: 'Kurang Berkesan (1/5)',
    2: 'Biasa Saja (2/5)',
    3: 'Lumayan Menyenangkan (3/5)',
    4: 'Sangat Seru & Romantis! (4/5)',
    5: 'Sempurna & Sangat Romantis! (5/5)'
  };

  starButtons.forEach(b => {
    const v = parseInt(b.dataset.val);
    if (v <= rating) {
      b.textContent = '★';
      b.className = 'star-btn text-2xl text-amber-400 hover:scale-110 transition';
    } else {
      b.textContent = '☆';
      b.className = 'star-btn text-2xl text-slate-300 hover:scale-110 transition';
    }
  });

  starRatingLabel.textContent = labels[rating] || `${rating}/5`;
}

function initDropzone() {
  dropzone.addEventListener('click', () => photoFilesInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-rose-500', 'bg-rose-100/50');
  });

  ['dragleave', 'dragend'].forEach(type => {
    dropzone.addEventListener(type, () => {
      dropzone.classList.remove('border-rose-500', 'bg-rose-100/50');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-rose-500', 'bg-rose-100/50');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  });

  photoFilesInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(e.target.files);
    }
  });
}

function compressImageFile(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      return resolve(file);
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          const safeName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          const compressed = new File([blob], safeName, { type: 'image/jpeg' });
          resolve(compressed);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

async function handleFilesSelected(files) {
  const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
  for (const file of validFiles) {
    try {
      const compressed = await compressImageFile(file);
      selectedFiles.push(compressed);
    } catch (err) {
      selectedFiles.push(file);
    }
  }
  renderSelectedPhotosPreview();
}

function renderSelectedPhotosPreview() {
  selectedPhotosPreview.innerHTML = '';
  selectedFiles.forEach((file, index) => {
    const objectUrl = URL.createObjectURL(file);
    const div = document.createElement('div');
    div.className = 'relative group aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200';
    div.innerHTML = `
      <img src="${objectUrl}" class="w-full h-full object-cover">
      <button type="button" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-rose-600 transition" onclick="removeSelectedFile(${index})">
        &times;
      </button>
      <div class="absolute bottom-0 inset-x-0 bg-black/50 text-[10px] text-white p-1 truncate text-center">${escapeHtml(file.name)}</div>
    `;
    selectedPhotosPreview.appendChild(div);
  });
}

window.removeSelectedFile = function(index) {
  selectedFiles.splice(index, 1);
  renderSelectedPhotosPreview();
};

async function handleUploadSubmit(e) {
  e.preventDefault();
  const dateId = uploadDateId.value;
  if (!dateId) return;

  const btnSubmit = document.getElementById('btnSubmitPhotos');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<span class="animate-spin mr-2">⏳</span> Mengunggah...`;

  try {
    // 1. Upload photos if any
    if (selectedFiles.length > 0) {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('photos', file);
      });

      const uploadRes = await fetch(`/api/dates/${dateId}/photos`, {
        method: 'POST',
        body: formData
      });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.success) {
        throw new Error(uploadJson.message || 'Gagal upload foto');
      }
    }

    // 2. Save review & memory journal
    const reviewPayload = {
      rating: parseInt(ratingInput.value) || 5,
      highlight: reviewHighlight.value.trim()
    };

    const reviewRes = await fetch(`/api/dates/${dateId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewPayload)
    });
    const reviewJson = await reviewRes.json();

    closeUploadModal();
    await loadDates();

    // Trigger sweet heart confetti animation
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.6 }
    });

    Swal.fire({
      icon: 'success',
      title: 'Kenangan Tersimpan Indah! 💖📸',
      text: 'Foto & momen manis date telah berhasil diabadikan!',
      timer: 2500,
      showConfirmButton: false
    });

  } catch (err) {
    console.error('Upload error:', err);
    Swal.fire({
      icon: 'error',
      title: 'Gagal',
      text: err.message || 'Terjadi kesalahan saat mengunggah foto.'
    });
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<i data-lucide="heart" class="w-4 h-4 fill-white"></i> <span>Simpan Kenangan Manis</span>`;
    initIcons();
  }
}

async function deletePhoto(dateId, photoId) {
  const result = await Swal.fire({
    title: 'Hapus Foto Ini?',
    text: 'Foto kenangan akan dihapus permanen.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#f43f5e',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal'
  });

  if (result.isConfirmed) {
    try {
      const res = await fetch(`/api/dates/${dateId}/photos/${photoId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        await loadDates();
        Swal.fire({ icon: 'success', title: 'Terhapus', text: json.message, timer: 1500, showConfirmButton: false });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal menghapus foto.' });
    }
  }
}

// ======================== MODAL: LIGHTBOX ========================

function openLightbox(url, caption = '', dateStr = '') {
  lightboxImg.src = url;
  lightboxCaption.textContent = caption || 'Kenangan Manis Kencan';
  lightboxDate.textContent = dateStr ? `Tanggal: ${dateStr}` : '';

  modalLightbox.classList.remove('hidden');
  modalLightbox.classList.add('flex');
}

function closeLightbox() {
  modalLightbox.classList.add('hidden');
  modalLightbox.classList.remove('flex');
}

// ======================== HELPER FUNCTIONS ========================

function formatIndoDate(dateString) {
  if (!dateString) return '-';
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, monthIndex, day);

      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return `${days[date.getDay()]}, ${day} ${months[monthIndex]} ${year}`;
    }
    return dateString;
  } catch (e) {
    return dateString;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.openCreateModal = openCreateModal;
window.editDate = editDate;
window.deleteDate = deleteDate;
window.openUploadModal = openUploadModal;
window.openLightbox = openLightbox;
window.deletePhoto = deletePhoto;
window.toggleActivity = toggleActivity;
