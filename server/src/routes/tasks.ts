import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import type { TaskStatus } from "@prisma/client";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectRole } from "../middleware/projectAccess.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

const createTaskSchema = z.object({
  title: z.string().min(1).max(300).trim(),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  assigneeId: z.string().cuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

router.get("/", async (req: AuthedRequest, res) => {
  const access = await requireProjectRole(req.params.projectId!, req.userId!, "MEMBER");
  if (!access) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const status = req.query.status as string | undefined;
  const where: { projectId: string; status?: TaskStatus } = { projectId: req.params.projectId! };
  if (status && ["TODO", "IN_PROGRESS", "DONE"].includes(status)) {
    where.status = status as TaskStatus;
  }
  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
  res.json(tasks);
});

router.post("/", async (req: AuthedRequest, res) => {
  const access = await requireProjectRole(req.params.projectId!, req.userId!, "MEMBER");
  if (!access) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { title, description, status, assigneeId, dueDate } = parsed.data;

  if (assigneeId) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId!, userId: assigneeId } },
    });
    if (!member) {
      res.status(400).json({ error: "Assignee must be a project member" });
      return;
    }
    if (access.role === "MEMBER" && assigneeId !== req.userId) {
      res.status(403).json({ error: "Members can only assign tasks to themselves" });
      return;
    }
  }

  const task = await prisma.task.create({
    data: {
      projectId: req.params.projectId!,
      title,
      description: description ?? null,
      status: status ?? "TODO",
      assigneeId: assigneeId ?? null,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdById: req.userId!,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  res.status(201).json(task);
});

const patchTaskSchema = z.object({
  title: z.string().min(1).max(300).trim().optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  assigneeId: z.string().cuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

async function loadTask(projectId: string, taskId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, projectId },
    include: { project: true },
  });
}

function memberCanEditTask(
  userId: string,
  role: "ADMIN" | "MEMBER",
  task: { assigneeId: string | null; createdById: string }
): boolean {
  if (role === "ADMIN") return true;
  return task.assigneeId === userId || task.createdById === userId;
}

router.patch("/:taskId", async (req: AuthedRequest, res) => {
  const access = await requireProjectRole(req.params.projectId!, req.userId!, "MEMBER");
  if (!access) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const task = await loadTask(req.params.projectId!, req.params.taskId!);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (!memberCanEditTask(req.userId!, access.role, task)) {
    res.status(403).json({ error: "You can only edit tasks you created or are assigned to" });
    return;
  }
  const parsed = patchTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const body = parsed.data;
  if (access.role === "MEMBER") {
    if (body.assigneeId !== undefined) {
      const next = body.assigneeId;
      if (next !== null && next !== req.userId) {
        res.status(403).json({ error: "Members cannot assign tasks to others" });
        return;
      }
      if (next !== null && task.assigneeId && task.assigneeId !== req.userId) {
        res.status(403).json({ error: "Cannot reassign a task assigned to someone else" });
        return;
      }
    }
  }

  if (body.assigneeId) {
    const m = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId!, userId: body.assigneeId } },
    });
    if (!m) {
      res.status(400).json({ error: "Assignee must be a project member" });
      return;
    }
  }

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.status !== undefined) data.status = body.status;
  if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

  const updated = await prisma.task.update({
    where: { id: task.id },
    data,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  res.json(updated);
});

router.delete("/:taskId", async (req: AuthedRequest, res) => {
  const access = await requireProjectRole(req.params.projectId!, req.userId!, "ADMIN");
  if (!access) {
    res.status(403).json({ error: "Only admins can delete tasks" });
    return;
  }
  const task = await loadTask(req.params.projectId!, req.params.taskId!);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  await prisma.task.delete({ where: { id: task.id } });
  res.status(204).send();
});

export default router;
