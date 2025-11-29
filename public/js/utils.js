export function formatErrorMessage(error) {
  if (!error) {
    return 'Unknown error';
  }

  if (typeof error === 'string') {
    return error;
  }

  const axiosResponse = error.response;
  if (axiosResponse) {
    const status = axiosResponse.status ?? '??';
    const details =
      axiosResponse.data?.error_description ||
      axiosResponse.data?.message ||
      JSON.stringify(axiosResponse.data);

    return `API ${status}: ${details}`;
  }

  if (error.request) {
    return 'Server did not respond. Please check server and network connection.';
  }

  return error.message || 'An error occurred';
}

export function extractIframeElement(html) {
  if (!html) {
    throw new Error('Response does not contain an iframe');
  }

  const temp = document.createElement('div');
  temp.innerHTML = html;
  const iframeElement = temp.querySelector('iframe');

  if (!iframeElement) {
    throw new Error('Failed to extract iframe from the server response');
  }

  ['onload', 'onerror'].forEach((attr) => iframeElement.removeAttribute(attr));

  return iframeElement;
}

export function buildIframeFromClients(clients) {
  if (!Array.isArray(clients) || clients.length === 0) {
    throw new Error('Server did not return TrueConf clients');
  }

  const webClient = clients.find(
    (client) => client?.type === 'web' && client?.platform === 'webrtc'
  );

  if (!webClient?.iframe) {
    throw new Error('TrueConf Web did not return an iframe');
  }

  return extractIframeElement(webClient.iframe);
}