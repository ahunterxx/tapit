"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

export async function requireAuthToken(): Promise<string> {
  const token = await getAuthToken();
  if (!token) redirect("/login");
  return token;
}

export async function getBusinessSession() {
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload as { businessId: string; email: string };
  } catch {
    return null;
  }
}
