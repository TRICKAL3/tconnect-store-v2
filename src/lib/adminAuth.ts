/** Same password as main admin panel and server ADMIN_PASS default. */
export const ADMIN_PASSWORD = '09090808pP#';

export function getAdminAuthHeaders(isAuthenticated: boolean): Record<string, string> {
  if (!isAuthenticated) return {};
  return { Authorization: 'Basic ' + btoa(ADMIN_PASSWORD) };
}
