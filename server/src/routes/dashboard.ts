import { Router } from "express";
import { prisma } from "../lib/db.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const now = new Date();

  const projectIds = (
    await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    })
  ).map((p) => p.projectId);

  if (projectIds.length === 0) {
    res.json({
      projects: 0,
      tasksByStatus: { TODO: 0, IN_PROGRESS: 0, DONE: 0 },
      overdue: 0,
      myAssignedOpen: 0,
      recentTasks: [],
    });
    return;
  }

  const [statusGroups, overdue, myAssigned, recentTasks] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: { projectId: { in: projectIds } },
      _count: { _all: true },
    }),
    prisma.task.count({
      where: {
        projectId: { in: projectIds },
        status: { not: "DONE" },
        dueDate: { lt: now },
      },
    }),
    prisma.task.count({
      where: {
        projectId: { in: projectIds },
        assigneeId: userId,
        status: { not: "DONE" },
      },
    }),
    prisma.task.findMany({
      where: { projectId: { in: projectIds } },
      take: 10,
      orderBy: { updatedAt: "desc" },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
  ]);

  const tasksByStatus = { TODO: 0, IN_PROGRESS: 0, DONE: 0 } as Record<string, number>;
  for (const g of statusGroups) {
    tasksByStatus[g.status] = g._count._all;
  }

  res.json({
    projects: projectIds.length,
    tasksByStatus,
    overdue,
    myAssignedOpen: myAssigned,
    recentTasks,
  });
});

export default router;
