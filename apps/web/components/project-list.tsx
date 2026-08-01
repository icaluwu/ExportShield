"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiRequest, compactAddress } from "@/lib/api";
import type { ProjectSummary } from "@/lib/project-types";

export function ProjectList({ showActivity = false }: { showActivity?: boolean }) {
  const account = useAccount();
  const projects = useQuery({
    queryKey: ["projects", account.address],
    queryFn: () => apiRequest<{ projects: ProjectSummary[] }>("/api/projects"),
  });

  if (projects.isPending) return <div className="skeleton-card" />;
  if (projects.isError) return <div className="status-line error-line" role="alert">{projects.error.message}</div>;
  if (!projects.data.projects.length) return <div className="empty-state">No projects yet. Create a private draft to begin.</div>;

  if (showActivity) {
    return <div className="panel detail-list">{projects.data.projects.map((project) => <div className="row-between" key={project.id}><div><strong>{project.title}</strong><div className="muted small">{new Date(project.updatedAt * 1000).toLocaleString()} · {project.linkStatus}</div></div>{project.creationTxHash ? <a className="button small-button ghost" href={`${process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ?? "https://testnet.monadexplorer.com"}/tx/${project.creationTxHash}`} target="_blank" rel="noreferrer">View transaction</a> : <span className="badge warning">Draft</span>}</div>)}</div>;
  }

  return <div className="project-grid">{projects.data.projects.map((project) => <Link className="project-card" href={`/project/?id=${project.id}`} key={project.id}><span className={`badge ${project.linkStatus === "draft" ? "warning" : ""}`}>{project.linkStatus}</span><h3>{project.title}</h3><p>{project.description.slice(0, 125)}{project.description.length > 125 ? "…" : ""}</p><div className="project-meta"><span>{project.category ?? "General"}</span><span>{project.onchainProjectId ? `#${project.onchainProjectId}` : compactAddress(project.freelancerAddress)}</span></div></Link>)}</div>;
}
