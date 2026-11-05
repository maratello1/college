/**
 * LabDrop | 1РУП8 — Клиентская логика премиального сервиса LabDrop
 * Архитектура: Strix SecOps XSS-safe DOM, Glassmorphism Animations, Live Monitor.
 * Разработчики: Савченков Артем и Алиев Марат (группа 1РУП8)
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- ТЕМА ОФОРМЛЕНИЯ (DARK OBSIDIAN / CRYSTAL FROST) ---
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const htmlRoot = document.documentElement;

  function initTheme() {
    const savedTheme = localStorage.getItem('labdrop_theme');
    if (savedTheme) {
      htmlRoot.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      htmlRoot.setAttribute('data-theme', 'light');
    } else {
      htmlRoot.setAttribute('data-theme', 'dark');
    }
  }

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = htmlRoot.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    htmlRoot.setAttribute('data-theme', newTheme);
    localStorage.setItem('labdrop_theme', newTheme);
  });

  initTheme();

  // --- DOM ЭЛЕМЕНТЫ ФОРМЫ ---
  const submissionForm = document.getElementById('submissionForm');
  const formCard = document.getElementById('formCard');
  const studentSelect = document.getElementById('studentSelect');
  const taskSelect = document.getElementById('taskSelect');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const dropzone = document.getElementById('dropzone');
  const dropzoneEmpty = document.getElementById('dropzoneEmpty');
  const selectedFileCard = document.getElementById('selectedFileCard');
  const selectedFileName = document.getElementById('selectedFileName');
  const selectedFileSize = document.getElementById('selectedFileSize');
  const fileTypeBadge = document.getElementById('fileTypeBadge');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const validationError = document.getElementById('validationError');
  const validationErrorText = document.getElementById('validationErrorText');
  const submitBtn = document.getElementById('submitBtn');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnText = document.getElementById('btnText');
  const uploadProgressWrap = document.getElementById('uploadProgressWrap');
  const uploadProgressBar = document.getElementById('uploadProgressBar');
  const progressPercentage = document.getElementById('progressPercentage');

  // --- DOM ЭЛЕМЕНТЫ ЭКРАНА ПОДТВЕРЖДЕНИЯ ---
  const successCard = document.getElementById('successCard');
  const successStudent = document.getElementById('successStudent');
  const successTask = document.getElementById('successTask');
  const successFilename = document.getElementById('successFilename');
  const successTime = document.getElementById('successTime');
  const successSize = document.getElementById('successSize');
  const copyFilenameBtn = document.getElementById('copyFilenameBtn');
  const copyFeedback = document.getElementById('copyFeedback');
  const resetFormBtn = document.getElementById('resetFormBtn');

  // --- DOM ЭЛЕМЕНТЫ МОНИТОРА И ДАШБОРДА ---
  const statTotalSubmissions = document.getElementById('statTotalSubmissions');
  const statUniqueStudents = document.getElementById('statUniqueStudents');
  const statPercent = document.getElementById('statPercent');
  const groupProgressFill = document.getElementById('groupProgressFill');
  const submissionsTableBody = document.getElementById('submissionsTableBody');
  const logSearchInput = document.getElementById('logSearchInput');
  const logTaskFilter = document.getElementById('logTaskFilter');
  const refreshStatsBtn = document.getElementById('refreshStatsBtn');

  // Константы валидации
  const ALLOWED_EXTENSIONS = ['.docx', '.doc', '.pdf', '.py', '.zip', '.rar', '.txt'];
  const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

  // Состояние
  let currentFile = null;
  let isSubmitting = false;
  let cachedSubmissions = [];

  /**
   * Strix Vector 4: Безопасное экранирование HTML от XSS
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Человекочитаемый размер файлов
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 КБ';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  /**
   * Получение расширения
   */
  function getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';
  }

  /**
   * Вывод ошибки валидации
   */
  function showError(message) {
    validationErrorText.textContent = message;
    validationError.style.display = 'flex';
    dropzone.classList.add('has-validation-error');
  }

  /**
   * Скрытие ошибки
   */
  function hideError() {
    validationError.style.display = 'none';
    validationErrorText.textContent = '';
    dropzone.classList.remove('has-validation-error');
  }

  /**
   * Валидация прикрепленного файла
   */
  function validateFile(file) {
    hideError();

    if (!file) return false;

    // 1. Проверка на пустой файл (0 байт)
    if (file.size === 0) {
      showError('Файл не содержит данных');
      return false;
    }

    // 2. Проверка размера (до 50 МБ)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showError('Размер файла превышает допустимые 50 МБ');
      return false;
    }

    // 3. Проверка допустимых форматов
    const ext = getFileExtension(file.name);
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      if (['.exe', '.bat', '.cmd', '.sh', '.vbs', '.msi', '.scr', '.ps1'].includes(ext)) {
        showError(`Файлы типа "${ext}" строго запрещены политикой безопасности колледжа. Разрешены: .docx, .doc, .pdf, .py, .zip, .rar, .txt`);
      } else {
        showError(`Формат "${ext || 'без расширения'}" недопустим. Разрешены: .docx, .doc, .pdf, .py, .zip, .rar, .txt`);
      }
      return false;
    }

    return true;
  }

  /**
   * Обновление состояния кнопки сдачи
   */
  function updateSubmitState() {
    const hasStudent = studentSelect.value.trim() !== '';
    const hasTask = taskSelect.value.trim() !== '';
    const hasValidFile = currentFile !== null;

    if (hasStudent && hasTask && hasValidFile && !isSubmitting) {
      submitBtn.removeAttribute('disabled');
    } else {
      submitBtn.setAttribute('disabled', 'true');
    }
  }

  /**
   * Обработка выбора файла
   */
  function handleFileSelected(file) {
    if (!file) return;

    if (validateFile(file)) {
      currentFile = file;
      const rawExt = getFileExtension(file.name).replace('.', '').toUpperCase();

      fileTypeBadge.textContent = rawExt || 'FILE';
      selectedFileName.textContent = file.name;
      selectedFileSize.textContent = formatFileSize(file.size);

      dropzoneEmpty.style.display = 'none';
      selectedFileCard.style.display = 'flex';
      hideError();
    } else {
      clearSelectedFile();
    }

    updateSubmitState();
  }

  /**
   * Сброс выбранного файла
   */
  function clearSelectedFile() {
    currentFile = null;
    fileInput.value = '';
    selectedFileCard.style.display = 'none';
    dropzoneEmpty.style.display = 'flex';
    updateSubmitState();
  }

  // --- СЛУШАТЕЛИ DRAG & DROP ---
  browseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput.click();
  });

  dropzone.addEventListener('click', (e) => {
    if (!currentFile && !e.target.closest('#removeFileBtn')) {
      fileInput.click();
    }
  });

  dropzone.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !currentFile) {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearSelectedFile();
    hideError();
  });

  ['dragenter', 'dragover'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-active');
    });
  });

  ['dragleave', 'dragend'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-active');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-active');

    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      handleFileSelected(dt.files[0]);
    }
  });

  studentSelect.addEventListener('change', updateSubmitState);
  taskSelect.addEventListener('change', updateSubmitState);

  // --- ОТПРАВКА РАБОТЫ НА СЕРВЕР ---
  submissionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentFile || !studentSelect.value || !taskSelect.value || isSubmitting) {
      updateSubmitState();
      return;
    }

    if (!validateFile(currentFile)) {
      return;
    }

    isSubmitting = true;
    submitBtn.setAttribute('disabled', 'true');
    btnSpinner.style.display = 'inline-block';
    btnText.textContent = 'Отправка...';
    hideError();

    // Прогресс-бар
    uploadProgressWrap.style.display = 'flex';
    uploadProgressBar.style.width = '20%';
    progressPercentage.textContent = '20%';

    const formData = new FormData();
    formData.append('student', studentSelect.value);
    formData.append('task', taskSelect.value);
    formData.append('file', currentFile, currentFile.name);

    // Добавляем honeypot (должен быть пустым)
    const hp = document.getElementById('honeypotField');
    if (hp && hp.value) {
      formData.append('middle_name_check', hp.value);
    }

    try {
      uploadProgressBar.style.width = '65%';
      progressPercentage.textContent = '65%';

      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });

      uploadProgressBar.style.width = '100%';
      progressPercentage.textContent = '100%';

      const result = await response.json();

      if (response.ok && result.status === 'ok') {
        // Успех: отображение карточки подтверждения
        successStudent.textContent = result.student || studentSelect.value;
        successTask.textContent = result.task || `Практическая работа №${taskSelect.value}`;
        successFilename.textContent = result.filename;
        successTime.textContent = result.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        successSize.textContent = result.size_kb ? `${result.size_kb} КБ` : formatFileSize(currentFile.size);

        // Переключение карточек
        formCard.style.display = 'none';
        successCard.style.display = 'flex';

        // Обновление дашборда и таблицы
        loadDashboardData();
      } else {
        showError(result.message || 'Ошибка при сохранении работы на сервере');
      }
    } catch (err) {
      console.error('Ошибка отправки:', err);
      showError('Не удалось связаться с сервером кабинета. Проверьте подключение к локальной сети.');
    } finally {
      isSubmitting = false;
      btnSpinner.style.display = 'none';
      btnText.textContent = 'Сдать работу';
      uploadProgressWrap.style.display = 'none';
      uploadProgressBar.style.width = '0%';
      updateSubmitState();
    }
  });

  // --- КОПИРОВАНИЕ ИМЕНИ ФАЙЛА В БУФЕР ---
  copyFilenameBtn.addEventListener('click', async () => {
    const textToCopy = successFilename.textContent.trim();
    if (!textToCopy || textToCopy === '—') return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      copyFeedback.textContent = 'Скопировано!';
      setTimeout(() => {
        copyFeedback.textContent = 'Копировать';
      }, 2000);
    } catch (e) {
      copyFeedback.textContent = 'Выделите текст';
    }
  });

  // --- ВОЗВРАТ К ФОРМЕ ("Сдать еще одну работу") ---
  resetFormBtn.addEventListener('click', () => {
    clearSelectedFile();
    taskSelect.value = '';
    hideError();

    successCard.style.display = 'none';
    formCard.style.display = 'block';
    updateSubmitState();
  });

  // --- МОНИТОР СТАРОСТЫ И ПРЕПОДАВАТЕЛЯ (DASHBOARD) ---
  async function loadDashboardData() {
    try {
      // 1. Статистика группы
      const statsResp = await fetch('/api/stats');
      if (statsResp.ok) {
        const stats = await statsResp.json();
        if (stats.status === 'ok') {
          statTotalSubmissions.textContent = stats.total_submissions;
          statUniqueStudents.textContent = `${stats.unique_students} / ${stats.group_size}`;
          statPercent.textContent = `${stats.percent}%`;
          groupProgressFill.style.width = `${Math.min(stats.percent, 100)}%`;
        }
      }

      // 2. Список сдач
      const subsResp = await fetch('/api/submissions');
      if (subsResp.ok) {
        const data = await subsResp.json();
        if (data.status === 'ok') {
          cachedSubmissions = data.submissions || [];
          renderSubmissionsTable();
        }
      }
    } catch (e) {
      console.warn('Дашборд временно недоступен:', e);
    }
  }

  function renderSubmissionsTable() {
    const query = logSearchInput.value.trim().toLowerCase();
    const taskFilter = logTaskFilter.value;

    const filtered = cachedSubmissions.filter(item => {
      const matchQuery = !query ||
        item.student.toLowerCase().includes(query) ||
        item.filename.toLowerCase().includes(query) ||
        item.task.toLowerCase().includes(query);

      let matchTask = true;
      if (taskFilter !== 'all') {
        matchTask = item.task.includes(`№${taskFilter}`);
      }

      return matchQuery && matchTask;
    });

    if (filtered.length === 0) {
      submissionsTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty-row">
            ${cachedSubmissions.length === 0 ? 'Работ пока не сдано. Сдайте первую работу прямо сейчас!' : 'Ничего не найдено по заданным фильтрам.'}
          </td>
        </tr>
      `;
      return;
    }

    submissionsTableBody.innerHTML = filtered.map(item => `
      <tr>
        <td><strong>${escapeHtml(item.datetime)}</strong></td>
        <td>${escapeHtml(item.student)}</td>
        <td>${escapeHtml(item.task)}</td>
        <td><code class="table-filename-tag">${escapeHtml(item.filename)}</code></td>
        <td>${escapeHtml(item.size_kb)}</td>
      </tr>
    `).join('');
  }

  logSearchInput.addEventListener('input', renderSubmissionsTable);
  logTaskFilter.addEventListener('change', renderSubmissionsTable);

  refreshStatsBtn.addEventListener('click', () => {
    refreshStatsBtn.style.opacity = '0.5';
    loadDashboardData().finally(() => {
      setTimeout(() => { refreshStatsBtn.style.opacity = '1'; }, 300);
    });
  });

  // Первоначальная загрузка дашборда и автообновление каждые 20 секунд
  loadDashboardData();
  setInterval(loadDashboardData, 20000);
});
