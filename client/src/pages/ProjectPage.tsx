import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";

type Member = {
  id: string;
  role: "ADMIN" | "MEMBER";
  user: { id: string; email: string; name: string };
};

type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  yourRole: "ADMIN" | "MEMBER";
  members: Member[];
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: string | null;
  assignee: { id: string; name: string; email: string } | null;
  createdBy: { id: string; name: string };
};

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [addingMember, setAddingMember] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskStatus, setTaskStatus] = useState<"TODO" | "IN_PROGRESS" | "DONE">("TODO");
  const [taskAssignee, setTaskAssignee] = useState<string>("");
  const [taskDue, setTaskDue] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  const isAdmin = project?.yourRole === "ADMIN";

  const load = useCallback(async () => {
    if (!token || !projectId) return;
    const [p, t] = await Promise.all([
      apiGet<ProjectDetail>(`/api/projects/${projectId}`, token),
      apiGet<TaskRow[]>(`/api/projects/${projectId}/tasks`, token),
    ]);
    setProject(p);
    setEditName(p.name);
    setEditDesc(p.description ?? "");
    setTasks(t);
  }, [projectId, token]);

  useEffect(() => {
    if (!projectId || !token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load project");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, projectId, token]);

  const memberOptions = useMemo(() => project?.members.map((m) => m.user) ?? [], [project]);

  async function saveProject(e: FormEvent) {
    e.preventDefault();
    if (!token || !projectId || !isAdmin) return;
    setSavingProject(true);
    setError(null);
    try {
      await apiPatch(`/api/projects/${projectId}`, { name: editName, description: editDesc || null }, token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingProject(false);
    }
  }

  async function deleteProject() {
    if (!token || !projectId || !isAdmin) return;
    if (!confirm("Delete this project and all tasks? This cannot be undone.")) return;
    try {
      await apiDelete(`/api/projects/${projectId}`, token);
      navigate("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function addMember(e: FormEvent) {
    e.preventDefault();
    if (!token || !projectId) return;
    setAddingMember(true);
    setError(null);
    try {
      await apiPost(`/api/projects/${projectId}/members`, { email: memberEmail, role: memberRole }, token);
      setMemberEmail("");
      setMemberRole("MEMBER");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add member");
    } finally {
      setAddingMember(false);
    }
  }

  async function removeMember(userId: string) {
    if (!token || !projectId) return;
    if (!confirm("Remove this member from the project?")) return;
    try {
      await apiDelete(`/api/projects/${projectId}/members/${userId}`, token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    }
  }

  async function createTask(e: FormEvent) {
    e.preventDefault();
    if (!token || !projectId) return;
    setCreatingTask(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title: taskTitle,
        description: taskDesc || null,
        status: taskStatus,
      };
      if (taskAssignee) body.assigneeId = taskAssignee;
      if (taskDue) body.dueDate = new Date(taskDue).toISOString();
      await apiPost(`/api/projects/${projectId}/tasks`, body, token);
      setTaskTitle("");
      setTaskDesc("");
      setTaskStatus("TODO");
      setTaskAssignee("");
      setTaskDue("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task");
    } finally {
      setCreatingTask(false);
    }
  }

  async function patchTask(task: TaskRow, patch: Partial<{ status: string; title: string }>) {
    if (!token || !projectId) return;
    setError(null);
    try {
      await apiPatch(`/api/projects/${projectId}/tasks/${task.id}`, patch, token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function deleteTask(taskId: string) {
    if (!token || !projectId || !isAdmin) return;
    if (!confirm("Delete this task?")) return;
    try {
      await apiDelete(`/api/projects/${projectId}/tasks/${taskId}`, token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (loading) return <div className="page-center muted">Loading project…</div>;
  if (!project) return <div className="error-banner">{error ?? "Project not found"}</div>;

  const now = new Date();

  return (
    <>
      <div className="row spread" style={{ marginBottom: "0.5rem" }}>
        <Link to="/projects" className="muted">
          ← All projects
        </Link>
        <span className={`badge ${isAdmin ? "admin" : ""}`}>{project.yourRole}</span>
      </div>
      <h1 className="page-title">{project.name}</h1>
      <p className="page-sub">{project.description || "No description yet."}</p>

      {error && <div className="error-banner">{error}</div>}

      {isAdmin && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Project settings</h2>
          <form onSubmit={saveProject}>
            <div className="field">
              <label htmlFor="ename">Name</label>
              <input id="ename" className="input" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="edesc">Description</label>
              <textarea id="edesc" className="input textarea" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
            <div className="row">
              <button className="btn" type="submit" disabled={savingProject}>
                {savingProject ? "Saving…" : "Save changes"}
              </button>
              <button className="btn danger" type="button" onClick={deleteProject}>
                Delete project
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Team</h2>
        {isAdmin && (
          <form onSubmit={addMember} style={{ marginBottom: "1rem" }}>
            <div className="row" style={{ alignItems: "flex-end", gap: "0.75rem" }}>
              <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="invite">Invite by email</label>
                <input
                  id="invite"
                  className="input"
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="invrole">Role</label>
                <select id="invrole" className="input" value={memberRole} onChange={(e) => setMemberRole(e.target.value as "ADMIN" | "MEMBER")}>
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <button className="btn secondary" type="submit" disabled={addingMember}>
                {addingMember ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        )}
        <div className="task-list">
          {project.members.map((m) => (
            <div key={m.id} className="task-item">
              <div className="row spread">
                <div>
                  <div className="task-title">{m.user.name}</div>
                  <div className="task-meta">{m.user.email}</div>
                </div>
                <div className="row">
                  <span className={`badge ${m.role === "ADMIN" ? "admin" : ""}`}>{m.role}</span>
                  {isAdmin && m.user.id !== user?.id ? (
                    <button type="button" className="btn ghost small" onClick={() => removeMember(m.user.id)}>
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>New task</h2>
        <form onSubmit={createTask}>
          <div className="field">
            <label htmlFor="ttitle">Title</label>
            <input id="ttitle" className="input" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="tdesc">Description</label>
            <textarea id="tdesc" className="input textarea" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} />
          </div>
          <div className="row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="field" style={{ minWidth: "140px", marginBottom: 0 }}>
              <label htmlFor="tstat">Status</label>
              <select id="tstat" className="input" value={taskStatus} onChange={(e) => setTaskStatus(e.target.value as typeof taskStatus)}>
                <option value="TODO">To do</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>
            <div className="field" style={{ minWidth: "180px", flex: 1, marginBottom: 0 }}>
              <label htmlFor="tassign">Assignee</label>
              <select id="tassign" className="input" value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
                <option value="">Unassigned</option>
                {memberOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ minWidth: "200px", marginBottom: 0 }}>
              <label htmlFor="tdue">Due</label>
              <input id="tdue" className="input" type="datetime-local" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
            </div>
          </div>
          <button className="btn" type="submit" disabled={creatingTask} style={{ marginTop: "0.5rem" }}>
            {creatingTask ? "Adding…" : "Add task"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Tasks</h2>
        {tasks.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No tasks yet.
          </p>
        ) : (
          <div className="task-list">
            {tasks.map((t) => {
              const overdue = t.dueDate && t.status !== "DONE" && new Date(t.dueDate) < now;
              const canEdit =
                isAdmin || t.assignee?.id === user?.id || t.createdBy.id === user?.id;
              return (
                <div key={t.id} className="task-item">
                  <div className="row spread" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div className="task-title">{t.title}</div>
                      {t.description && <div className="task-meta">{t.description}</div>}
                      <div className="task-meta">
                        Created by {t.createdBy.name}
                        {t.assignee ? ` · Assigned to ${t.assignee.name}` : ""}
                        {t.dueDate ? ` · Due ${new Date(t.dueDate).toLocaleString()}` : ""}
                        {overdue ? <span className="badge overdue">Overdue</span> : null}
                      </div>
                    </div>
                    <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.35rem" }}>
                      <select
                        className="input"
                        value={t.status}
                        disabled={!canEdit}
                        onChange={(e) => patchTask(t, { status: e.target.value })}
                      >
                        <option value="TODO">To do</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="DONE">Done</option>
                      </select>
                      {isAdmin ? (
                        <button type="button" className="btn ghost small" onClick={() => deleteTask(t.id)}>
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
