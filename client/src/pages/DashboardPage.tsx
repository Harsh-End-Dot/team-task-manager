import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiGet } from "@/lib/api";

type Dashboard = {
  projects: number;
  tasksByStatus: { TODO: number; IN_PROGRESS: number; DONE: number };
  overdue: number;
  myAssignedOpen: number;
  recentTasks: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    project: { id: string; name: string };
    assignee: { id: string; name: string } | null;
  }>;
};

export function DashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await apiGet<Dashboard>("/api/dashboard", token);
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <div className="page-center muted">Loading dashboard…</div>;

  const now = new Date();

  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">Overview across every project you belong to.</p>

      <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <div className="stat-value">{data.projects}</div>
          <div className="stat-label">Active projects</div>
        </div>
        <div className="card">
          <div className="stat-value">{data.myAssignedOpen}</div>
          <div className="stat-label">Open tasks assigned to you</div>
        </div>
        <div className="card">
          <div className="stat-value" style={{ color: data.overdue ? "var(--danger)" : undefined }}>
            {data.overdue}
          </div>
          <div className="stat-label">Overdue (not done)</div>
        </div>
        <div className="card">
          <div className="stat-value">{data.tasksByStatus.DONE}</div>
          <div className="stat-label">Completed tasks</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Tasks by status</h2>
        <div className="row spread">
          <span className="muted">To do</span>
          <strong>{data.tasksByStatus.TODO}</strong>
        </div>
        <div className="row spread">
          <span className="muted">In progress</span>
          <strong>{data.tasksByStatus.IN_PROGRESS}</strong>
        </div>
        <div className="row spread">
          <span className="muted">Done</span>
          <strong>{data.tasksByStatus.DONE}</strong>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>Recently updated</h2>
        {data.recentTasks.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No tasks yet. <Link to="/projects">Create a project</Link> and add tasks.
          </p>
        ) : (
          <div className="task-list">
            {data.recentTasks.map((t) => {
              const overdue = t.dueDate && t.status !== "DONE" && new Date(t.dueDate) < now;
              return (
                <div key={t.id} className="task-item">
                  <div className="row spread">
                    <Link to={`/projects/${t.project.id}`} className="task-title" style={{ color: "inherit" }}>
                      {t.title}
                    </Link>
                    <span className="badge">{t.status.replace("_", " ")}</span>
                  </div>
                  <div className="task-meta">
                    {t.project.name}
                    {t.assignee ? ` · ${t.assignee.name}` : ""}
                    {t.dueDate ? ` · due ${new Date(t.dueDate).toLocaleDateString()}` : ""}
                    {overdue ? <span className="badge overdue">Overdue</span> : null}
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
