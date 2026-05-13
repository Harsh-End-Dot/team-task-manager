import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectRole } from "../middleware/projectAccess.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const access = await requireProjectRole(req.params.projectId!, req.userId!, "MEMBER");
  if (!access) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const members = await prisma.projectMember.findMany({
    where: { projectId: req.params.projectId! },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });
  res.json(members);
});

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

router.post("/", async (req: AuthedRequest, res) => {
  const access = await requireProjectRole(req.params.projectId!, req.userId!, "ADMIN");
  if (!access) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, role } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    res.status(404).json({ error: "No user with that email" });
    return;
  }
  if (user.id === req.userId && role === "MEMBER") {
    res.status(400).json({ error: "Cannot demote yourself via invite" });
    return;
  }
  try {
    const member = await prisma.projectMember.create({
      data: { projectId: req.params.projectId!, userId: user.id, role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    res.status(201).json(member);
  } catch {
    res.status(409).json({ error: "User is already a member" });
  }
});

const patchRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

router.patch("/:userId", async (req: AuthedRequest, res) => {
  const access = await requireProjectRole(req.params.projectId!, req.userId!, "ADMIN");
  if (!access) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const parsed = patchRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const targetId = req.params.userId!;
  if (targetId === req.userId && parsed.data.role === "MEMBER") {
    const adminCount = await prisma.projectMember.count({
      where: { projectId: req.params.projectId!, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      res.status(400).json({ error: "Project must keep at least one admin" });
      return;
    }
  }
  try {
    const updated = await prisma.projectMember.update({
      where: { projectId_userId: { projectId: req.params.projectId!, userId: targetId } },
      data: { role: parsed.data.role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Member not found" });
  }
});

router.delete("/:userId", async (req: AuthedRequest, res) => {
  const access = await requireProjectRole(req.params.projectId!, req.userId!, "ADMIN");
  if (!access) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const targetId = req.params.userId!;
  if (targetId === req.userId) {
    res.status(400).json({ error: "Remove yourself by leaving the project (not implemented); ask another admin" });
    return;
  }
  try {
    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: req.params.projectId!, userId: targetId } },
    });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Member not found" });
  }
});

export default router;
