import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectRole } from "../middleware/projectAccess.js";

const router = Router();
router.use(requireAuth);

const createProjectSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional().nullable(),
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { name, description } = parsed.data;
  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        name,
        description: description ?? null,
        ownerId: req.userId!,
      },
    });
    await tx.projectMember.create({
      data: { projectId: p.id, userId: req.userId!, role: "ADMIN" },
    });
    return p;
  });
  res.status(201).json(project);
});

router.get("/", async (req: AuthedRequest, res) => {
  const memberships = await prisma.projectMember.findMany({
    where: { userId: req.userId! },
    include: {
      project: {
        include: {
          _count: { select: { tasks: true, members: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
  res.json(
    memberships.map((m) => ({
      ...m.project,
      role: m.role,
      counts: m.project._count,
    }))
  );
});

router.get("/:projectId", async (req: AuthedRequest, res) => {
  const access = await requireProjectRole(req.params.projectId, req.userId!, "MEMBER");
  if (!access) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const project = await prisma.project.findUnique({
    where: { id: req.params.projectId },
    include: {
      members: {
        include: { user: { select: { id: true, email: true, name: true } } },
      },
      _count: { select: { tasks: true } },
    },
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json({ ...project, yourRole: access.role });
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).optional().nullable(),
});

router.patch("/:projectId", async (req: AuthedRequest, res) => {
  const access = await requireProjectRole(req.params.projectId, req.userId!, "ADMIN");
  if (!access) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const project = await prisma.project.update({
    where: { id: req.params.projectId },
    data,
  });
  res.json(project);
});

router.delete("/:projectId", async (req: AuthedRequest, res) => {
  const access = await requireProjectRole(req.params.projectId, req.userId!, "ADMIN");
  if (!access) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  await prisma.project.delete({ where: { id: req.params.projectId } });
  res.status(204).send();
});

export default router;
