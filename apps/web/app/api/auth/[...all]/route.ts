export const dynamic = "force-dynamic";

import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

export async function GET(request: Request): Promise<Response> {
  const { GET: handler } = toNextJsHandler(getAuth());
  return handler(request);
}

export async function POST(request: Request): Promise<Response> {
  const { POST: handler } = toNextJsHandler(getAuth());
  return handler(request);
}
