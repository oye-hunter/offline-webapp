import { auth } from "@clerk/nextjs/server";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db/drizzle";
import { notes } from "@/lib/schema/notes";

interface SyncNotePayload {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();

    if (!Array.isArray(body)) {
      return Response.json({ error: "Expected array" }, { status: 400 });
    }

    const rows = body as SyncNotePayload[];

    for (const item of rows) {
      if (item.userId !== userId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await db
      .insert(notes)
      .values(
        rows.map((item) => ({
          id: item.id,
          userId: item.userId,
          title: item.title,
          content: item.content,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        })),
      )
      .onConflictDoUpdate({
        target: notes.id,
        set: {
          title: sql`excluded.title`,
          content: sql`excluded.content`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

    return Response.json({ ok: true }, { status: 200 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
