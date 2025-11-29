require('dotenv').config({ override: true });

const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { transliterate } = require('transliteration');

// Check if self-signed certificates are allowed
const enableSelfSigned = String(process.env.ALLOW_SELF_SIGNED).toLowerCase() === 'true';
if (enableSelfSigned) {
  console.warn('⚠️ ALLOW_SELF_SIGNED=true — TLS certificate validation is disabled. Use only in development.');
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const LOCALES_DIR = path.join(__dirname, 'locales'); 

// Serve static files from the 'locales' directory under the '/locales' path
app.use('/locales', express.static(LOCALES_DIR));
app.use(express.json({ limit: '1mb' }));

// Required environment variables
const REQUIRED_ENV = ['SERVER', 'CLIENT_ID', 'CLIENT_SECRET', 'CONF_OWNER_TRUECONF_ID'];
const TOKEN_ENDPOINT = '/oauth2/v1/token';
const CONFERENCE_ENDPOINT = '/api/v3.11/conferences';
const WEBCLIENT_ENDPOINT = '/api/v3.11/software/clients';

function safeStringify(payload) {
  try {
    return JSON.stringify(payload);
  } catch (err) {
    return '"[unserializable]"';
  }
}

function logAction(action, meta) {
  const timestamp = new Date().toISOString();
  if (meta && Object.keys(meta).length) {
    console.log(`[${timestamp}] ${action} ${safeStringify(meta)}`);
  } else {
    console.log(`[${timestamp}] ${action}`);
  }
}

function maskSecret(secret = '') {
  if (!secret) {
    return '';
  }
  if (secret.length <= 6) {
    return '*'.repeat(secret.length);
  }
  return `${secret.slice(0, 3)}***${secret.slice(-3)}`;
}

// Get frontend configuration, including the current language
function getFrontendConfig(currentLang = 'en') {
  return {
    SERVER_CONFIGURED: Boolean(process.env.SERVER && process.env.CLIENT_ID && process.env.CLIENT_SECRET),
    CONF_OWNER_TRUECONF_ID: process.env.CONF_OWNER_TRUECONF_ID,
    CONF_TOPIC_TEMPLATE: process.env.CONF_TOPIC_TEMPLATE || 'Meeting with patient {{name}}', // Default template
    CURRENT_LANGUAGE: currentLang // Add current language to config
  };
}

// Load translation files at startup
const loadTranslations = () => {
  const locales = {};
  try {
    const files = fs.readdirSync(LOCALES_DIR);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const locale = path.basename(file, '.json');
        const filePath = path.join(LOCALES_DIR, file);
        locales[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    });
  } catch (e) {
    console.warn('Locales directory not found or does not contain JSON files, localization is disabled.');
  }
  return locales;
};

const translations = loadTranslations();
console.log('Loaded translations:', Object.keys(translations));

// Inject configuration script into HTML
function injectEnvConfig(html, config) {
  const marker = '<!--ENV-->';
  const configScript = `
    <script>
      window.APP_CONFIG = ${JSON.stringify(config)};
    </script>
  `;

  if (!html.includes(marker)) {
    return html.replace(/<\/body>/i, `${configScript}\n</body>`);
  }

  return html.replace(marker, `${configScript}\n`);
}

function normalizeServerUrl(value) {
  if (!/^https?:\/\//i.test(value)) {
    value = 'https://' + value;
  }
  return value.replace(/\/+$/, '');
}

function assertEnvConfig() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  logAction('env:validated', {
    SERVER: process.env.SERVER,
    CLIENT_ID: process.env.CLIENT_ID,
    CLIENT_SECRET: maskSecret(process.env.CLIENT_SECRET),
    CONF_OWNER_TRUECONF_ID: process.env.CONF_OWNER_TRUECONF_ID
  });
}

function slugifyName(value) {
  return transliterate(value || '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 100) || 'guest_user';
}

function inferDisplayName(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'guest';
  }

  const topic = typeof payload.topic === 'string' ? payload.topic.trim() : '';
  if (topic) {
    const match = topic.match(/patient\s+(.+)$/i); // Assuming English topic
    if (match?.[1]) {
      return match[1].trim();
    }
    return topic;
  }

  const invitationName = payload.invitations?.find((inv) => inv?.display_name)?.display_name;
  if (invitationName) {
    return invitationName;
  }

  return payload.owner || 'guest';
}

async function fetchAccessToken() {
  const server = normalizeServerUrl(process.env.SERVER);
  logAction('oauth:request_token:start', { server });
  const response = await axios.post(
    `${server}${TOKEN_ENDPOINT}`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    }
  );

  const token = response.data?.access_token;
  if (!token) {
    throw new Error('OAuth server did not return an access_token');
  }
  logAction('oauth:request_token:success', { hasToken: Boolean(token) });
  return { token, server };
}

async function createTrueConfClient() {
  assertEnvConfig();
  const { token, server } = await fetchAccessToken();

  const api = axios.create({
    baseURL: server,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    timeout: 15000
  });

  logAction('api:client_ready', { server });
  return api;
}

async function createConferenceLifecycle(api, conferencePayload) {
  logAction('conference:create:start', {
    topic: conferencePayload?.topic,
    owner: conferencePayload?.owner
  });
  const { data } = await api.post(CONFERENCE_ENDPOINT, conferencePayload);
  const conferenceId = data?.conference?.id;

  if (!conferenceId) {
    throw new Error('API did not return a conference ID');
  }

  logAction('conference:create:success', { conferenceId });
  await api.post(`${CONFERENCE_ENDPOINT}/${conferenceId}/run`);
  logAction('conference:run', { conferenceId });
  await api.get(`${CONFERENCE_ENDPOINT}/${conferenceId}`);
  logAction('conference:refresh', { conferenceId });
  return conferenceId;
}

async function fetchWebClientClients(api, conferenceId, patientName) {
  logAction('conference:clients:request', { conferenceId, patientName });
  const { data } = await api.get(WEBCLIENT_ENDPOINT, {
    params: {
      call_id: conferenceId,
      user: `2$${slugifyName(patientName)}*${patientName}`,
      case: 'join_conference_button'
    }
  });

  if (!Array.isArray(data?.clients) || data.clients.length === 0) {
    throw new Error('TrueConf Web did not return a list of clients');
  }

  logAction('conference:clients:received', {
    conferenceId,
    total: data.clients.length
  });

  return data.clients;
}

async function generateConferenceClients(conferencePayload) {
  logAction('conference:flow:start', {
    topic: conferencePayload?.topic,
    owner: conferencePayload?.owner
  });
  const api = await createTrueConfClient();
  const conferenceId = await createConferenceLifecycle(api, conferencePayload);
  const displayName = inferDisplayName(conferencePayload);
  const clients = await fetchWebClientClients(api, conferenceId, displayName);
  logAction('conference:flow:success', { conferenceId, topic: conferencePayload?.topic });
  return { clients, conferenceId };
}

// Helper function to inject translations into HTML
const injectTranslations = (html, lang) => {
  const langTranslations = translations[lang] || translations['en']; // Default to 'en'
  if (!langTranslations) {
    console.warn(`Translations for language '${lang}' not found, using fallback.`);
    return html; // Return HTML unchanged if no translations
  }

  let translatedHtml = html;

  // Improved regex for paired tags, including <title>
  // Find tags with data-i18n and replace their *inner* content
  const tagWithI18nRegex = /(<(\w+)[^>]*\s+data-i18n="([^"]+)"[^>]*>)([^<]*|.*?)(<\/\2>)/gs;
  translatedHtml = translatedHtml.replace(tagWithI18nRegex, (match, opening, tagName, key, innerContent, closing) => {
     const translation = langTranslations[key];
     if (translation !== undefined) {
       return `${opening}${translation}${closing}`;
     }
     return match; // Return as is
  });

  // Handle <title> tag separately if it contains data-i18n
  // Find <title data-i18n="..."> and replace its content
  const titleRegex = /(<title[^>]*\s+data-i18n="([^"]+)"[^>]*>)(.*?)(<\/title>)/i;
  translatedHtml = translatedHtml.replace(titleRegex, (match, opening, key, content, closing) => {
     const translation = langTranslations[key];
     if (translation !== undefined) {
       return `${opening}${translation}${closing}`;
     }
     return match; // Return as is
  });

  return translatedHtml;
};

// Function to determine language (simplified, can be improved)
const getLanguageFromRequest = (req) => {
  // 1. Try to get language from URL path, e.g., /ru/, /en/
  const pathLang = req.path.split('/')[1];
  if (translations[pathLang]) {
    return pathLang;
  }
  // 2. Try to get from query parameter, e.g., ?lang=ru
  if (req.query.lang && translations[req.query.lang]) {
    return req.query.lang;
  }
  // 3. Default to English
  return 'en';
};

// Change GET route '/'
app.get(['/', '/en', '/ru'], (req, res) => { // Handle root, /en, /ru
  try {
    const requestedLang = getLanguageFromRequest(req);
    const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
    const translatedHtml = injectTranslations(html, requestedLang);

    // Update frontend config to let it know the current language
    const frontendConfig = getFrontendConfig(requestedLang);

    const finalHtml = injectEnvConfig(translatedHtml, frontendConfig);
    // Set language in HTML header
    res.set('Content-Language', requestedLang);
    res.type('html').send(finalHtml);
  } catch (err) {
    console.error('❌ HTML generation error:', err);
    res.status(500).send('Server Error');
  }
});

app.post('/api/conference', async (req, res) => {
  try {
    logAction('http:/api/conference:received', { body: req.body });
    const conferencePayload = req.body?.conference;

    if (!conferencePayload || typeof conferencePayload !== 'object') {
      return res.status(400).json({ message: 'Provide a conference object' });
    }

    const { clients, conferenceId } = await generateConferenceClients(conferencePayload);
    logAction('http:/api/conference:success', {
      conferenceId,
      clientCount: clients.length
    });
    res.json({ clients, conferenceId });
  } catch (error) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.error_description ||
      error.response?.data?.message ||
      error.message ||
      'TrueConf API Error';

    logAction('conference:flow:error', {
      status,
      message,
      stack: error?.stack
    });
    res.status(status).json({ message });
  }
});

app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
  }
}));

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});