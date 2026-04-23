export class BearerTokenAuthService {
  constructor({ token }) {
    if (!token) {
      throw new TypeError('BearerTokenAuthService requires a token');
    }

    this.token = token;
  }

  authenticate(headers = {}) {
    return {
      authenticated: bearerToken(headers) === this.token
    };
  }
}

function bearerToken(headers) {
  const authorization = header(headers, 'authorization');
  const match = /^Bearer\s+(.+)$/i.exec(authorization);

  return match?.[1] ?? '';
}

function header(headers, name) {
  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  );

  return entry?.[1] ?? '';
}
