import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiGet, apiPost } from "@/lib/api";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  role: "ADMIN" | "MEMBER";
  counts: { tasks: number; members: number };
};

export function ProjectsPage() {
  const { token } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    if (!token) return;
    const list = await apiGet<ProjectRow[]>("/api/projects", token);
    setProjects(list);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    setError(null);
    try {
      await apiPost("/api/projects", { name, description: description || null }, token);
      setName("");
      setDescription("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="page-center muted">Loading projects…</div>;

  return (
    <>
      <h1 className="page-title">Projects</h1>
      <p className="page-sub">Create a space for your team, then invite members with Admin or Member roles.</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem" }}>New project</h2>
        <form onSubmit={onCreate}>
          <div className="field">
            <label htmlFor="pname">Name</label>
            <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pdesc">Description (optional)</label>
            <textarea id="pdesc" className="input textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create project"}
          </button>
        </form>
      </div>

      <div className="task-list">
        {projects.length === 0 ? (
          <p className="muted">No projects yet. Create your first one above.</p>
        ) : (
          projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="project-link">
              <div className="row spread">
                <strong>{p.name}</strong>
                <span className={`badge ${p.role === "ADMIN" ? "admin" : ""}`}>{p.role}</span>
              </div>
              {p.description && <div className="task-meta">{p.description}</div>}
              <div className="task-meta">
                {p.counts.members} members · {p.counts.tasks} tasks
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
