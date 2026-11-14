const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

const app = express();
const PORT = process.env.PORT || 3000;

const os = require('os');

// Directories setup (compatible with standard servers and Vercel serverless)
const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel ? path.join(os.tmpdir(), 'pincha_data') : path.join(__dirname, 'data');
const UPLOADS_DIR = isVercel ? path.join(os.tmpdir(), 'pincha_uploads') : path.join(__dirname, 'uploads');
const DATA_FILE = path.join(DATA_DIR, 'dates.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Seed empty data if missing
if (!fs.existsSync(DATA_FILE)) {
  const seedPath = path.join(__dirname, 'data', 'dates.json');
  if (fs.existsSync(seedPath)) {
    try {
      fs.copyFileSync(seedPath, DATA_FILE);
    } catch (e) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
    }
  } else {
    fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
  }
}

// Helper read/write
function readDates() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading dates:", err);
    return [];
  }
}

function writeDates(dates) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dates, null, 2), 'utf-8');
}

// Multer storage for uploaded photos (memoryStorage so photos can be embedded as Data URLs on serverless & saved locally)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max per image
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diperbolehkan!'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Prevent caching on all API routes so laptop & handphone are always in sync
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// 1. Get all dates
app.get('/api/dates', (req, res) => {
  const dates = readDates();
  res.json({ success: true, data: dates });
});

// 2. Get single date
app.get('/api/dates/:id', (req, res) => {
  const dates = readDates();
  const found = dates.find(d => d.id === req.params.id);
  if (!found) return res.status(404).json({ success: false, message: 'Jadwal date tidak ditemukan' });
  res.json({ success: true, data: found });
});

// 3. Create new date
app.post('/api/dates', (req, res) => {
  try {
    const { title, date, time, location, locationMapUrl, dressCode, notes, activities } = req.body;
    if (!title || !date || !time || !location) {
      return res.status(400).json({ success: false, message: 'Judul, tanggal, jam, dan lokasi wajib diisi!' });
    }

    // Validasi agar tanggal dan jam tidak di masa lalu
    const targetDateTime = new Date(`${date}T${time}`);
    if (isNaN(targetDateTime.getTime()) || targetDateTime.getTime() < Date.now() - 60000) {
      return res.status(400).json({ success: false, message: 'Tanggal dan jam kencan tidak boleh waktu yang telah berlalu!' });
    }

    const dates = readDates();
    const newDate = {
      id: uuidv4(),
      title: title.trim(),
      date,
      time,
      location: location.trim(),
      locationMapUrl: locationMapUrl ? locationMapUrl.trim() : `https://maps.google.com/?q=${encodeURIComponent(location.trim())}`,
      dressCode: dressCode ? dressCode.trim() : '',
      notes: notes ? notes.trim() : '',
      status: 'upcoming',
      activities: Array.isArray(activities) ? activities.map(act => ({
        id: act.id || uuidv4(),
        time: act.time || '',
        task: act.task || '',
        done: Boolean(act.done)
      })) : [],
      photos: [],
      review: null,
      createdAt: new Date().toISOString()
    };

    dates.unshift(newDate);
    writeDates(dates);
    res.status(201).json({ success: true, message: 'Jadwal date berhasil dibuat! 💕', data: newDate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Update date details
app.put('/api/dates/:id', (req, res) => {
  try {
    const dates = readDates();
    const index = dates.findIndex(d => d.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: 'Jadwal date tidak ditemukan' });

    const existing = dates[index];
    const { title, date, time, location, locationMapUrl, dressCode, notes, activities, status } = req.body;

    dates[index] = {
      ...existing,
      title: title !== undefined ? title.trim() : existing.title,
      date: date !== undefined ? date : existing.date,
      time: time !== undefined ? time : existing.time,
      location: location !== undefined ? location.trim() : existing.location,
      locationMapUrl: locationMapUrl !== undefined ? locationMapUrl.trim() : existing.locationMapUrl,
      dressCode: dressCode !== undefined ? dressCode.trim() : existing.dressCode,
      notes: notes !== undefined ? notes.trim() : existing.notes,
      status: status !== undefined ? status : existing.status,
      activities: activities !== undefined ? activities : existing.activities,
      updatedAt: new Date().toISOString()
    };

    writeDates(dates);
    res.json({ success: true, message: 'Jadwal date berhasil diperbarui!', data: dates[index] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Toggle activity checkbox
app.patch('/api/dates/:id/activities/:activityId/toggle', (req, res) => {
  const dates = readDates();
  const dateObj = dates.find(d => d.id === req.params.id);
  if (!dateObj) return res.status(404).json({ success: false, message: 'Date tidak ditemukan' });

  const act = dateObj.activities.find(a => a.id === req.params.activityId);
  if (!act) return res.status(404).json({ success: false, message: 'Aktivitas tidak ditemukan' });

  act.done = !act.done;
  writeDates(dates);
  res.json({ success: true, data: dateObj });
});

// 6. Upload photos for a date
app.post('/api/dates/:id/photos', upload.array('photos', 10), (req, res) => {
  try {
    const dates = readDates();
    const dateObj = dates.find(d => d.id === req.params.id);
    if (!dateObj) return res.status(404).json({ success: false, message: 'Jadwal date tidak ditemukan' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada foto yang diunggah!' });
    }

    const captions = req.body.captions ? (Array.isArray(req.body.captions) ? req.body.captions : [req.body.captions]) : [];

    const newPhotos = req.files.map((file, i) => {
      const base64Data = file.buffer.toString('base64');
      const mimeType = file.mimetype || 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      return {
        id: uuidv4(),
        filename: file.originalname || `photo-${Date.now()}.jpg`,
        url: dataUrl,
        caption: captions[i] || '',
        uploadedAt: new Date().toISOString()
      };
    });

    if (!dateObj.photos) dateObj.photos = [];
    dateObj.photos.push(...newPhotos);

    // If date was upcoming, automatically mark as completed once photos are uploaded
    if (dateObj.status === 'upcoming') {
      dateObj.status = 'completed';
    }

    writeDates(dates);
    res.json({ success: true, message: `${newPhotos.length} foto berhasil diupload! 📸✨`, data: dateObj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. Delete a photo
app.delete('/api/dates/:id/photos/:photoId', (req, res) => {
  const dates = readDates();
  const dateObj = dates.find(d => d.id === req.params.id);
  if (!dateObj) return res.status(404).json({ success: false, message: 'Jadwal date tidak ditemukan' });

  const photoIndex = (dateObj.photos || []).findIndex(p => p.id === req.params.photoId);
  if (photoIndex === -1) return res.status(404).json({ success: false, message: 'Foto tidak ditemukan' });

  const photo = dateObj.photos[photoIndex];
  // Remove local file if exists in uploads
  if (photo.filename && !photo.url.startsWith('http')) {
    const filePath = path.join(UPLOADS_DIR, photo.filename);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { console.error(e); }
    }
  }

  dateObj.photos.splice(photoIndex, 1);
  writeDates(dates);
  res.json({ success: true, message: 'Foto berhasil dihapus', data: dateObj });
});

// 8. Update review / memory journal
app.post('/api/dates/:id/review', (req, res) => {
  try {
    const dates = readDates();
    const dateObj = dates.find(d => d.id === req.params.id);
    if (!dateObj) return res.status(404).json({ success: false, message: 'Jadwal date tidak ditemukan' });

    const { rating, highlight } = req.body;
    dateObj.review = {
      rating: Number(rating) || 5,
      highlight: (highlight || '').trim(),
      completedAt: new Date().toISOString()
    };
    dateObj.status = 'completed';

    writeDates(dates);
    res.json({ success: true, message: 'Kenangan kencan berhasil disimpan! 💖', data: dateObj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 9. Delete a date
app.delete('/api/dates/:id', (req, res) => {
  const dates = readDates();
  const index = dates.findIndex(d => d.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Jadwal date tidak ditemukan' });

  const dateObj = dates[index];
  // Delete associated local photos
  if (dateObj.photos && dateObj.photos.length > 0) {
    dateObj.photos.forEach(photo => {
      if (photo.filename && !photo.url.startsWith('http')) {
        const filePath = path.join(UPLOADS_DIR, photo.filename);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) { }
        }
      }
    });
  }

  dates.splice(index, 1);
  writeDates(dates);
  res.json({ success: true, message: 'Jadwal kencan berhasil dihapus' });
});

// Stats API
app.get('/api/stats', (req, res) => {
  const dates = readDates();
  const total = dates.length;
  const completed = dates.filter(d => d.status === 'completed').length;
  const upcoming = dates.filter(d => d.status === 'upcoming').length;
  const totalPhotos = dates.reduce((acc, d) => acc + (d.photos ? d.photos.length : 0), 0);

  res.json({
    success: true,
    data: {
      total,
      completed,
      upcoming,
      totalPhotos
    }
  });
});

// Serve frontend for all remaining routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`💖 Pincha Space server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
