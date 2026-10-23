// Session cookies on path `/`, URI-encoded: the same format the old jquery.cookie client wrote,
// so seats and admin rights from before the upgrade keep working.

function getCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split('; ')
    .find((pair) => pair.startsWith(prefix));
  return cookie === undefined
    ? null
    : decodeURIComponent(cookie.slice(prefix.length));
}

function setCookie(name: string, value: string): void {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/`;
}

/** The id the server knows this browser by in every room, or null before the first connect. */
export function getSessionId(): string | null {
  return getCookie('sessionId');
}

/** Keeps the first socket id this browser connected with as its session id. */
export function ensureSessionId(socketId: string): void {
  if (getSessionId() === null) setCookie('sessionId', socketId);
}

/** Whether this browser created the room and gets its admin controls. */
export function isAdmin(roomUrl: string): boolean {
  return getCookie(`admin-${roomUrl}`) !== null;
}

/** Remembers that this browser is the room's admin. */
export function markAdmin(roomUrl: string): void {
  setCookie(`admin-${roomUrl}`, 'true');
}
