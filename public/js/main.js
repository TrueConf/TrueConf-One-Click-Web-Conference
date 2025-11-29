import { formatErrorMessage, buildIframeFromClients } from './utils.js';
import { buildConferencePayload } from './conferencePayload.js';
import {
  getPatientName,
  toggleButtonLoading,
  hideRegistration,
  renderIframe,
  setStatus
} from './dom.js';
import { startListeningForLogout } from './MessageChannel.js';

let isBusy = false;

async function requestConference(conferencePayload) {
  const response = await fetch('/api/conference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conference: conferencePayload })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Server returned an error');
  }

  return data;
}

async function handleJoinClick(event) {
  event?.preventDefault();

  if (isBusy) {
    return;
  }

  const patientName = getPatientName();
  if (!patientName) {
    setStatus('Please enter the patient name', 'error');
    return;
  }

  toggleButtonLoading(true);
  isBusy = true;
  setStatus('Getting access to the server...');

  try {
    setStatus('Creating conference...');
    const conferencePayload = buildConferencePayload(patientName);
    const { clients } = await requestConference(conferencePayload);

    setStatus('Getting TrueConf Web...');
    const iframe = buildIframeFromClients(clients);

    hideRegistration();
    renderIframe(iframe);
    setStatus('Conference is ready!', 'success');

    startListeningForLogout();

  } catch (error) {
    console.error('Conference flow error:', error);
    setStatus(formatErrorMessage(error), 'error');
  } finally {
    isBusy = false;
    toggleButtonLoading(false);
  }
}

document.getElementById('fetchBtn')?.addEventListener('click', handleJoinClick);