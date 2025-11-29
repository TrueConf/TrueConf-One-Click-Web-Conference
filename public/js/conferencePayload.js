const RIGHTS_TEMPLATE = Object.freeze({
  chat_send: true,
  chat_rcv: true,
  slide_show_send: true,
  slide_show_rcv: true,
  white_board_send: true,
  white_board_rcv: true,
  file_transfer_send: true,
  file_transfer_rcv: true,
  desktop_sharing: true,
  recording: true,
  audio_send: true,
  audio_rcv: true,
  video_send: true,
  video_rcv: true
});

const cloneRights = () => ({
  guest: { ...RIGHTS_TEMPLATE },
  user: { ...RIGHTS_TEMPLATE }
});

function getTrueConfId() {
  const trueConfId = window.APP_CONFIG?.CONF_OWNER_TRUECONF_ID;

  if (trueConfId === "your_trueconf_username") {
    console.error("Enter correct CONF_OWNER_TRUECONF_ID in .env");
    return undefined;
  }

  return trueConfId;
}

export function buildConferencePayload(patientName) {
  const safeName = (patientName || '').trim() || 'guest';
  const ownerId = getTrueConfId();

  const topicTemplate = window.APP_CONFIG?.CONF_TOPIC_TEMPLATE || 'Встреча с пациентом {{name}}';
  const topic = topicTemplate.replace('{{name}}', safeName);

  return {
    type: 0,
    topic: topic,
    owner: ownerId,
    description: '',
    max_podiums: 2,
    max_participants: 2,
    schedule: { type: -1 },
    invitations: [{ id: ownerId}],
    allow_guests: true,
    auto_invite: 1,
    state: 'running',
    recording: 0,
    stream_recording_state: 0,
    rights: cloneRights(),
    allow_only_planned_participants: false
  };
}
