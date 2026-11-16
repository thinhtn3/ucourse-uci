import { searchCourses } from "@/lib/course-index";
import type { CourseSearchResponse } from "@/lib/types";

function reply(body: CourseSearchResponse, status = 200) {
  return Response.json(body, { status });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 80);
  const department = (params.get("department") ?? "").trim().slice(0, 24);
  const prefix = (params.get("prefix") ?? "").trim();
  if (!q && !department) return reply({ results: [], error: "Pass q or department." }, 400);
  if (!/^[A-Za-z]?\d{0,3}[A-Za-z]{0,4}$/.test(prefix)) return reply({ results: [], error: "Bad prefix." }, 400);

  const max = department && !q ? 300 : 20;
  const asked = Number.parseInt(params.get("limit") ?? "", 10);
  const limit = Math.min(Math.max(Number.isFinite(asked) ? asked : 12, 1), max);

  try {
    return reply({ results: searchCourses({ q, department: department || undefined, prefix, limit }) });
  } catch (err) {
    console.error("course search failed", err);
    return reply({ results: [], error: "Course search is unavailable right now." });
  }
}
