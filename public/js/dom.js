function t(key) {
  const currentLang = window.APP_CONFIG?.CURRENT_LANGUAGE || 'en';
  const translations = window.i18nData?.[currentLang] || {}; 
  return translations[key] || key; 
}

const selectors = {
  registration: document.getElementById('reg'),
  nameInput: document.getElementById('name'),
  actionButton: document.getElementById('fetchBtn'),
  iframeContainer: document.getElementById('iframe-container'),
  status: document.getElementById('result'),
  overlay: document.getElementById('overlay'),
  body: document.body
};

export function getPatientName() {
  return selectors.nameInput?.value?.trim() || '';
}

export function toggleButtonLoading(isLoading) {
  if (!selectors.actionButton) {
    return;
  }

  selectors.actionButton.disabled = isLoading;
  selectors.actionButton.textContent = isLoading ? t('creating') : t('enter_button');
}

export function hideRegistration() {
  if (selectors.body) {
    selectors.body.classList.add('conference-active');
  }
}

export function renderIframe(iframeElement) {
  if (!selectors.iframeContainer) {
    return;
  }
  selectors.iframeContainer.innerHTML = '';
  selectors.iframeContainer.appendChild(iframeElement);
}

export function setStatus(message, variant = 'info') {
  if (!selectors.status) {
    return;
  }

  selectors.status.textContent = message;
  selectors.status.dataset.variant = variant;
}

export function resetUI() {
  if (selectors.body) {
    selectors.body.classList.remove('conference-active');
  }
  if (selectors.iframeContainer) {
    selectors.iframeContainer.innerHTML = '';
  }
  if (selectors.status) {
    selectors.status.textContent = '';
    selectors.status.removeAttribute('data-variant');
  }
}