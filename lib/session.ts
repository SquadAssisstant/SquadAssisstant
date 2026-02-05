import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);
const COOKIE_NAME = "sa_session";

export type SessionPayload = {
  profileId: string;
  username: string;
};

export function sessionCookieName() {
  return COOKIE_NAME;
}

export async function signSession(payload: SessionPayload, expiresIn: string) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn) // "2h", "30d"
    .sign(secret);
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as SessionPayload & { exp: number; iat: number };
}
