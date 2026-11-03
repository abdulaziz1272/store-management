// One place that talks to the backend. All requests start with /api.

const BASE_URL = '/api';

// { page: 1, search: '' } -> "?page=1"   (empty values are skipped)
function toQuery(params) {
  if (!params) {
    return '';
  }

  const search = new URLSearchParams();

  for (const key of Object.keys(params)) {
    const value = params[key];

    if (value === undefined || value === null || value === '') {
      continue;
    }

    search.append(key, value);
  }

  const text = search.toString();
  return text ? '?' + text : '';
}

async function request(method, url, body) {
  const options = {
    method,
    headers: {},
    credentials: 'same-origin',
  };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(BASE_URL + url, options);

  // The login ended (cookie expired). Tell the app, so it opens the login page.
  if (response.status === 401 && !url.startsWith('/auth/login')) {
    window.dispatchEvent(new Event('session-expired'));
  }

  let data = null;

  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const message = data && data.message ? data.message : 'Xatolik yuz berdi';
    throw new Error(message);
  }

  return data;
}

export const api = {
  get(url, params) {
    return request('GET', url + toQuery(params));
  },

  post(url, body) {
    return request('POST', url, body || {});
  },

  put(url, body) {
    return request('PUT', url, body || {});
  },

  // Downloads a file (for example a PDF) and saves it on the computer
  async download(url, params, fileName) {
    const response = await fetch(BASE_URL + url + toQuery(params), { credentials: 'same-origin' });

    if (!response.ok) {
      let message = 'Faylni yuklab bo\'lmadi';

      try {
        const data = await response.json();
        message = data.message || message;
      } catch (error) {
        // keep the default message
      }

      throw new Error(message);
    }

    const blob = await response.blob();
    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(link.href);
  },
};
