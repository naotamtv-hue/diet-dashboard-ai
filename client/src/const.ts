export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// In-app login route. Auth is handled by our own email/password flow
// (see the auth card on the landing screen), so this just points at "/".
export const getLoginUrl = () => "/login";
