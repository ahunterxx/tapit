import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function proxy(req: NextRequest, path: string[], method: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  const url = `${API}/${path.join("/")}`;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  const body =
    method !== "GET" && method !== "HEAD" ? await req.text() : undefined;

  const res = await fetch(url, { method, headers, body });
  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params.path, "GET");
}
export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params.path, "POST");
}
export async function PUT(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params.path, "PUT");
}
export async function PATCH(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params.path, "PATCH");
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxy(req, params.path, "DELETE");
}
