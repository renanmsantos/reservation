import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";

const ADMIN_COOKIE_NAME = "admin_session";

const getAdminSecret = () => {
  const secret = process.env.ADMIN_ACCESS_TOKEN;
  if (!secret) {
    throw new Error("ADMIN_ACCESS_TOKEN não está configurada.");
  }
  return secret;
};

export const getAdminSessionValue = () => {
  const secret = getAdminSecret();
  return createHash("sha256").update(secret).digest("hex");
};

export const assertAdminAuthenticated = async () => {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!session || session !== getAdminSessionValue()) {
    redirect("/admin/login");
  }
};

export const isAdminAuthenticated = async () => {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(ADMIN_COOKIE_NAME)?.value === getAdminSessionValue();
  } catch (error) {
    console.warn("Admin auth check skipped:", error);
    return false;
  }
};

export const createAdminSessionCookie = () => ({
  name: ADMIN_COOKIE_NAME,
  value: getAdminSessionValue(),
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 8,
});

export const destroyAdminSessionCookie = () => ({
  name: ADMIN_COOKIE_NAME,
  value: "",
  path: "/",
  maxAge: 0,
});

export const ensureAdminToken = (token: string) => token === getAdminSecret();
