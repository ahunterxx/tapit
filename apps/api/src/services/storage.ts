import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return null;
    }
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return supabase;
}

export async function uploadFile(
  bucket: string,
  filePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string | null> {
  const client = getSupabase();

  if (!client) {
    // Local fallback: save to disk during dev
    const uploadDir = path.join(process.cwd(), "uploads", bucket);
    fs.mkdirSync(uploadDir, { recursive: true });
    const localPath = path.join(uploadDir, path.basename(filePath));
    fs.writeFileSync(localPath, buffer);
    return `/uploads/${bucket}/${path.basename(filePath)}`;
  }

  try {
    const { error } = await client.storage
      .from(bucket)
      .upload(filePath, buffer, { contentType, upsert: true });

    if (error) {
      console.error("Supabase upload error:", error.message);
      return null;
    }

    const { data } = client.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  } catch (err) {
    console.error("Supabase upload exception:", err instanceof Error ? err.message : err);
    return null;
  }
}
