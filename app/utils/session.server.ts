import { createCookieSessionStorage } from "@remix-run/node";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "arrankar_session",
    secure: process.env.NODE_ENV === "production",
    secrets: [process.env.SESSION_SECRET || "dev_secret"],
    sameSite: "lax",
    path: "/",
    httpOnly: true,
  },
});

export async function getSession(request: Request) {
  const cookie = request.headers.get("Cookie");
  return sessionStorage.getSession(cookie);
} 