/**
 * LabDrop | 1РУП8 — Клиентская логика веб-сервиса сдачи практических работ
 * Разработчики: Савченков Артем и Алиев Марат (группа 1РУП8)
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Элементы формы
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

  // DOM Элементы экрана успеха
  const successCard = document.getElementById('successCard');
  const successStudent = document.getElementById('successStudent');
  const successTask = document.getElementById('successTask');
  const successFilename = document.getElementById('successFilename');
  const successTime = document.getElementById('successTime');
  const successSize = document.getElementById('successSize');
  const resetFormBtn = document.getElementById('resetFormBtn');

  // Журнал преподавателя
  const toggleTeacherLog = document.getElementById('toggleTeacherLog');
  const teacherPanel = document.querySelector('.teacher-panel');
  const teacherLogContent = document.getElementById('teacherLogContent');
  const logTableBody = document.getElementById('logTableBody');

  // Константы валидации
  const ALLOWED_EXTENSIONS = ['.docx', '.doc', '.pdf', '.py', '.zip', '.rar', '.txt'];
  const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 МБ

  // Текущее состояние
  let currentFile = null;
  let isSubmitting = false;

  /**
   * Форматирование байтов в человекочитаемый размер
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 КБ';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  /**
   * Получение расширения файла
   */
  function getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';
  }

  /**
   * Отображение ошибки валидации
   */
  function showError(message) {
    validationErrorText.textContent = message;
    validationError.style.display = 'flex';
    dropzone.classList.add('has-error');
  }

  /**
   * Скрытие ошибки валидации
   */
  function hideError() {
    validationError.style.display = 'none';
    validationErrorText.textContent = '';
    dropzone.classList.remove('has-error');
  }

  /**
   * Валидация выбранного файла
   */
  function validateFile(file) {
    hideError();

    if (!file) {
      return false;
    }

    // 1. Проверка на пустой файл (0 байт)
    if (file.size === 0) {
      showError('Файл не содержит данных');
      return false;
    }

    // 2. Проверка максимального размера (50 МБ)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showError('Размер файла превышает допустимые 50 МБ');
      return false;
    }

    // 3. Проверка формата файла
    const ext = getFileExtension(file.name);
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      if (ext === '.exe' || ext === '.bat' || ext === '.cmd' || ext === '.sh') {
        showError(`Файлы типа "${ext}" запрещены из соображений безопасности. Разрешены: .docx, .doc, .pdf, .py, .zip, .rar, .txt`);
      } else {
        showError(`Недопустимый формат файла "${ext || 'без расширения'}". Разрешены только: .docx, .doc, .pdf, .py, .zip, .rar, .txt`);
      }
      return false;
    }

    return true;
  }

  /**
   * Проверка готовности всей формы к отправке
   */
  function updateSubmitButtonState() {
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
   * Применение выбранного файла
   */
  function handleFileSelected(file) {
    if (!file) return;

    if (validateFile(file)) {
      currentFile = file;
      const ext = getFileExtension(file.name).replace('.', '').toUpperCase();

      fileTypeBadge.textContent = ext || 'FILE';
      selectedFileName.textContent = file.name;
      selectedFileSize.textContent = formatFileSize(file.size);

      // Визуальный переход в состояние "файл прикреплен"
      dropzoneEmpty.style.display = 'none';
      selectedFileCard.style.display = 'flex';
      hideError();
    } else {
      clearSelectedFile();
    }

    updateSubmitButtonState();
  }

  /**
   * Сброс прикрепленного файла
   */
  function clearSelectedFile() {
    currentFile = null;
    fileInput.value = '';
    selectedFileCard.style.display = 'none';
    dropzoneEmpty.style.display = 'flex';
    updateSubmitButtonState();
  }

  // --- Слушатели событий формы ---

  // Вызов окна выбора файла
  browseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput.click();
  });

  dropzone.addEventListener('click', (e) => {
    // Если клик не по кнопке удаления файла и файл еще не выбран
    if (!currentFile && !e.target.closest('#removeFileBtn')) {
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

  // Drag and Drop события
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'dragend'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-over');

    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      handleFileSelected(dt.files[0]);
    }
  });

  // Изменение селектов
  studentSelect.addEventListener('change', () => {
    updateSubmitButtonState();
  });

  taskSelect.addEventListener('change', () => {
    updateSubmitButtonState();
  });

  // --- Отправка формы на сервер ---
  submissionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentFile || !studentSelect.value || !taskSelect.value || isSubmitting) {
      updateSubmitButtonState();
      return;
    }

    // Повторная валидация перед сетевым запросом
    if (!validateFile(currentFile)) {
      return;
    }

    // Перевод кнопки в состояние отправки с блокировкой
    isSubmitting = true;
    submitBtn.setAttribute('disabled', 'true');
    btnSpinner.style.display = 'inline-block';
    btnText.textContent = 'Отправка...';
    hideError();

    const formData = new FormData();
    formData.append('student', studentSelect.value);
    formData.append('task', taskSelect.value);
    formData.append('file', currentFile, currentFile.name);

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });

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

        // Обновление журнала преподавателя в фоне, если открыт
        if (teacherLogContent.style.display !== 'none') {
          loadTeacherLog();
        }
      } else {
        // Ошибка с сервера
        showError(result.message || 'Ошибка при сохранении работы на сервере');
      }
    } catch (err) {
      console.error('Ошибка отправки:', err);
      showError('Не удалось связаться с сервером. Проверьте соединение с локальной сетью кабинета.');
    } finally {
      isSubmitting = false;
      btnSpinner.style.display = 'none';
      btnText.textContent = 'Сдать работу';
      updateSubmitButtonState();
    }
  });

  // --- Возврат к форме ("Сдать еще одну работу") ---
  resetFormBtn.addEventListener('click', () => {
    // Очистка полей
    clearSelectedFile();
    taskSelect.value = '';
    // Студента можно оставить для удобства или сбросить
    hideError();

    // Переключение обратно на форму
    successCard.style.display = 'none';
    formCard.style.display = 'block';
    updateSubmitButtonState();
  });

  // --- Разворачивание журнала преподавателя ---
  async function loadTeacherLog() {
    try {
      const resp = await fetch('/api/submissions');
      if (!resp.ok) return;
      const data = await resp.json();

      if (data.submissions && data.submissions.length > 0) {
        logTableBody.innerHTML = data.submissions.map(item => `
          <tr>
            <td><strong>${item.datetime}</strong></td>
            <td>${item.student}</td>
            <td>${item.task}</td>
            <td><code class="file-tag">${item.filename}</code></td>
            <td>${item.size_kb}</td>
          </tr>
        `).join('');
      } else {
        logTableBody.innerHTML = '<tr><td colspan="5" class="empty-log">Пока никто не сдал работы на этой паре. Будьте первым!</td></tr>';
      }
    } catch (e) {
      logTableBody.innerHTML = '<tr><td colspan="5" class="empty-log">Не удалось загрузить данные журнала</td></tr>';
    }
  }

  toggleTeacherLog.addEventListener('click', (e) => {
    // Если клик по кнопке скачивания CSV, не сворачиваем/разворачиваем
    if (e.target.closest('.btn-csv-download')) {
      return;
    }

    const isOpen = teacherLogContent.style.display !== 'none';
    if (isOpen) {
      teacherLogContent.style.display = 'none';
      teacherPanel.classList.remove('open');
    } else {
      teacherLogContent.style.display = 'block';
      teacherPanel.classList.add('open');
      loadTeacherLog();
    }
  });
});
