import { resetUI } from './dom.js';

let isListening = false;

export function startListeningForLogout() {
  if (isListening) {
    return;
  }

  isListening = true;

  window.addEventListener('message', (event) => {
    if (typeof event.data === 'object' && event.data !== null) {
      const message = event.data;

      if (message.type === 'logout') {
        const iframeContainer = document.querySelector('.iframe-container');

        if (iframeContainer) {
          iframeContainer.innerHTML = '';
          resetUI();
          isListening = false;
        }
      }
    }
  });
}