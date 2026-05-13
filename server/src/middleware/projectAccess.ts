import { prisma } from "../lib/db.js";
import type { ProjectRole } from "@prisma/client";

export async function getMembership(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

export async function requireProjectRole(
  projectId: string,
  userId: string,
  minRole: "MEMBER" | "ADMIN"
): Promise<{ role: ProjectRole } | null> {
  const m = await getMembership(projectId, userId);
  if (!m) return null;
  if (minRole === "ADMIN" && m.role !== "ADMIN") return null;
  return { role: m.role };
}
