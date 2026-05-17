import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Check,
  CheckCircle2,
  Circle,
  CircleDashed,
  FolderKanban,
  Inbox,
  Link2,
  LogOut,
  Loader2,
  PanelRight,
  Plus,
  Send,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Owner = {
  id: string;
  name: string;
  initials: string;
  createdAtUtc: string;
};

type Project = {
  id: string;
  name: string;
  description: string;
  issueCount: number;
  doneIssueCount: number;
  createdAtUtc: string;
};

type Issue = {
  id: string;
  issueNumber: number;
  code: string;
  title: string;
  description: string;
  status: IssueStatus;
  isCompleted: boolean;
  projectId: string;
  projectName: string;
  ownerId: string | null;
  owner: Owner | null;
  createdAtUtc: string;
};

type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  ownerId: string | null;
  isActive: boolean;
  createdAtUtc: string;
  lastLoginAtUtc: string;
};

type Route =
  | { name: "issues" }
  | { name: "projects" }
  | { name: "issue"; id: string }
  | { name: "project"; id: string };

type IssueStatus = "Backlog" | "Todo" | "In Progress" | "Done";
type IssueFilter = "all" | "active" | "backlog";

type IssueDraft = {
  title: string;
  description: string;
  status: IssueStatus;
  projectId: string;
  ownerId: string;
};

type ProjectDraft = {
  name: string;
  description: string;
};

const issueStatuses: IssueStatus[] = ["Backlog", "Todo", "In Progress", "Done"];
const activeIssueStatuses: IssueStatus[] = ["In Progress", "Todo"];
const issueFilterOptions: { value: IssueFilter; label: string }[] = [
  { value: "all", label: "All issues" },
  { value: "active", label: "Active" },
  { value: "backlog", label: "Backlog" },
];
const unassignedValue = "unassigned";

const emptyIssueDraft: IssueDraft = {
  title: "",
  description: "",
  status: "Todo",
  projectId: "",
  ownerId: "",
};

const emptyProjectDraft: ProjectDraft = {
  name: "",
  description: "",
};

const parseRoute = (): Route => {
  const segments = window.location.pathname.split("/").filter(Boolean);

  if (segments[0] === "projects" && segments[1]) {
    return { name: "project", id: segments[1] };
  }

  if (segments[0] === "projects") {
    return { name: "projects" };
  }

  if (segments[0] === "issues" && segments[1]) {
    return { name: "issue", id: segments[1] };
  }

  return { name: "issues" };
};

const getRoutePath = (route: Route) => {
  if (route.name === "project") {
    return `/projects/${route.id}`;
  }

  if (route.name === "projects") {
    return "/projects";
  }

  if (route.name === "issue") {
    return `/issues/${route.id}`;
  }

  return "/";
};

const getAuthRedirectError = () => {
  const params = new URLSearchParams(window.location.search);
  const description = params.get("error_description");
  const error = params.get("error");

  return description || error;
};

const getStatusIcon = (status: IssueStatus, className?: string) => {
  const iconClassName = cn("size-4", className);

  if (status === "Done") {
    return <CheckCircle2 className={cn(iconClassName, "text-indigo-400")} />;
  }

  if (status === "Backlog") {
    return <CircleDashed className={cn(iconClassName, "text-zinc-500")} />;
  }

  if (status === "In Progress") {
    return <CircleDashed className={cn(iconClassName, "text-yellow-400")} />;
  }

  return <Circle className={cn(iconClassName, "text-zinc-400")} />;
};

const getStatusTone = (status: IssueStatus) => {
  if (status === "Done") {
    return "border-indigo-500/30 bg-indigo-500/10 text-indigo-200";
  }

  if (status === "In Progress") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-100";
  }

  if (status === "Backlog") {
    return "border-zinc-700 bg-zinc-900 text-zinc-400";
  }

  return "border-zinc-700 bg-zinc-900 text-zinc-200";
};

function App() {
  const {
    getAccessTokenSilently,
    isAuthenticated,
    isLoading: isAuthLoading,
    loginWithRedirect,
    logout,
    user: auth0User,
  } = useAuth0();
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(
    null,
  );
  const [owners, setOwners] = useState<Owner[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [issueDraft, setIssueDraft] = useState<IssueDraft>(emptyIssueDraft);
  const [projectDraft, setProjectDraft] =
    useState<ProjectDraft>(emptyProjectDraft);
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("active");
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const immediateSaveKeyRef = useRef<string | null>(null);

  const authenticatedFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const token = await getAccessTokenSilently();
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);

      return fetch(input, {
        ...init,
        headers,
      });
    },
    [getAccessTokenSilently],
  );

  const navigate = (nextRoute: Route) => {
    window.history.pushState(null, "", getRoutePath(nextRoute));
    setRoute(nextRoute);
  };

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute());

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const loadWorkspace = useCallback(async () => {
    try {
      setError(null);

      const meResponse = await authenticatedFetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: auth0User?.email ?? "",
          name: auth0User?.name ?? auth0User?.nickname ?? "",
          avatarUrl: auth0User?.picture ?? "",
        }),
      });

      if (!meResponse.ok) {
        throw new Error("Current user request failed.");
      }

      const nextUser = (await meResponse.json()) as AuthenticatedUser;

      const [ownersResponse, projectsResponse, issuesResponse] =
        await Promise.all([
          authenticatedFetch("/api/owners"),
          authenticatedFetch("/api/projects"),
          authenticatedFetch("/api/issues"),
        ]);

      if (!ownersResponse.ok || !projectsResponse.ok || !issuesResponse.ok) {
        throw new Error("Workspace request failed.");
      }

      const [nextOwners, nextProjects, nextIssues] = (await Promise.all([
        ownersResponse.json(),
        projectsResponse.json(),
        issuesResponse.json(),
      ])) as [Owner[], Project[], Issue[]];

      setCurrentUser(nextUser);
      setOwners(nextOwners);
      setProjects(nextProjects);
      setIssues(nextIssues);
      setIssueDraft((currentDraft) => ({
        ...currentDraft,
        projectId: currentDraft.projectId || nextProjects[0]?.id || "",
        ownerId: currentDraft.ownerId || nextOwners[0]?.id || "",
      }));
    } catch {
      setError("Could not load the workspace. Make sure the API is running.");
    } finally {
      setIsLoading(false);
    }
  }, [auth0User, authenticatedFetch]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void loadWorkspace();
  }, [isAuthenticated, loadWorkspace]);

  useEffect(() => {
    if (route.name !== "issue") {
      setSelectedIssue(null);
      return;
    }

    const cachedIssue = issues.find((issue) => issue.id === route.id);

    if (cachedIssue) {
      setSelectedIssue(cachedIssue);
      setIssueDraft(toIssueDraft(cachedIssue));
    }

    const loadIssue = async () => {
      try {
        setError(null);

        const response = await authenticatedFetch(`/api/issues/${route.id}`);

        if (!response.ok) {
          throw new Error("Issue request failed.");
        }

        const issue = (await response.json()) as Issue;
        setSelectedIssue(issue);
        setIssueDraft(toIssueDraft(issue));
      } catch {
        setError("Could not load this issue.");
      }
    };

    void loadIssue();
  }, [authenticatedFetch, issues, route]);

  useEffect(() => {
    if (route.name !== "project") {
      setSelectedProject(null);
      return;
    }

    const cachedProject = projects.find((project) => project.id === route.id);

    if (cachedProject) {
      setSelectedProject(cachedProject);
      setProjectDraft({
        name: cachedProject.name,
        description: cachedProject.description,
      });
    }

    const loadProject = async () => {
      try {
        setError(null);

        const response = await authenticatedFetch(`/api/projects/${route.id}`);

        if (!response.ok) {
          throw new Error("Project request failed.");
        }

        const project = (await response.json()) as Project & {
          issues: Issue[];
        };
        setSelectedProject(project);
        setProjectDraft({
          name: project.name,
          description: project.description,
        });
        setIssues((currentIssues) =>
          mergeIssues(currentIssues, project.issues),
        );
      } catch {
        setError("Could not load this project.");
      }
    };

    void loadProject();
  }, [authenticatedFetch, projects, route]);

  const visibleIssues = useMemo(() => {
    if (route.name === "project") {
      return issues.filter((issue) => issue.projectId === route.id);
    }

    return issues;
  }, [issues, route]);

  const filteredIssueStatuses = useMemo(() => {
    if (issueFilter === "active") {
      return activeIssueStatuses;
    }

    if (issueFilter === "backlog") {
      return ["Backlog"] satisfies IssueStatus[];
    }

    return ["In Progress", "Todo", "Backlog", "Done"] satisfies IssueStatus[];
  }, [issueFilter]);

  const groupedIssues = useMemo(
    () =>
      filteredIssueStatuses.map((status) => ({
        status,
        issues: visibleIssues.filter((issue) => issue.status === status),
      })),
    [filteredIssueStatuses, visibleIssues],
  );

  const currentTitle =
    route.name === "projects"
      ? "Projects"
      : route.name === "project"
        ? (selectedProject?.name ?? "Project")
        : route.name === "issue"
          ? (selectedIssue?.code ?? "Issue")
          : "Issues";
  const parentTitle =
    route.name === "project"
      ? "Projects"
      : route.name === "issue"
        ? "Issues"
        : "Todo";
  const parentRoute: Route =
    route.name === "project" ? { name: "projects" } : { name: "issues" };
  const hasParentRoute = route.name === "project" || route.name === "issue";

  const canSaveIssue = Boolean(issueDraft.title.trim() && issueDraft.projectId);
  const canSaveProject = Boolean(projectDraft.name.trim());

  const openNewIssue = (status: IssueStatus = "Todo", projectId?: string) => {
    setIssueDraft({
      ...emptyIssueDraft,
      status,
      projectId: projectId ?? selectedProject?.id ?? projects[0]?.id ?? "",
      ownerId: owners[0]?.id ?? "",
    });
    setIsCreatingIssue(true);
  };

  const handleCreateIssue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSaveIssue) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await authenticatedFetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toIssuePayload(issueDraft)),
      });

      if (!response.ok) {
        throw new Error("Create issue request failed.");
      }

      const createdIssue = (await response.json()) as Issue;
      setIssues((currentIssues) => [...currentIssues, createdIssue]);
      setIsCreatingIssue(false);
      setIssueDraft(emptyIssueDraft);
      await loadWorkspace();
    } catch {
      setError("Could not create the issue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveIssueDraft = useCallback(
    async (issue: Issue, draft: IssueDraft) => {
      setError(null);

      const response = await authenticatedFetch(`/api/issues/${issue.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toIssuePayload(draft)),
      });

      if (!response.ok) {
        throw new Error("Update issue request failed.");
      }

      const updatedIssue = (await response.json()) as Issue;
      setSelectedIssue(updatedIssue);
      setIssues((currentIssues) =>
        currentIssues.map((issue) =>
          issue.id === updatedIssue.id ? updatedIssue : issue,
        ),
      );
      await loadWorkspace();
    },
    [authenticatedFetch, loadWorkspace],
  );

  const handleIssueDraftChange = (
    nextDraft: IssueDraft,
    saveImmediately = false,
  ) => {
    setIssueDraft(nextDraft);

    if (
      !saveImmediately ||
      route.name !== "issue" ||
      !selectedIssue ||
      !nextDraft.title.trim() ||
      !nextDraft.projectId ||
      isSameIssueDraft(selectedIssue, nextDraft)
    ) {
      return;
    }

    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current);
    }

    immediateSaveKeyRef.current = getIssueDraftKey(nextDraft);

    void saveIssueDraft(selectedIssue, nextDraft).catch(() => {
      immediateSaveKeyRef.current = null;
      setError("Could not save the issue.");
    });
  };

  const handleAssignIssueOwner = (issue: Issue, ownerId: string) => {
    if ((issue.ownerId ?? "") === ownerId) {
      return;
    }

    const owner = owners.find((candidate) => candidate.id === ownerId) ?? null;
    const nextDraft = {
      ...toIssueDraft(issue),
      ownerId,
    };
    const nextIssue = {
      ...issue,
      ownerId: owner?.id ?? null,
      owner,
    };

    setIssues((currentIssues) =>
      currentIssues.map((currentIssue) =>
        currentIssue.id === issue.id ? nextIssue : currentIssue,
      ),
    );

    if (selectedIssue?.id === issue.id) {
      setSelectedIssue(nextIssue);
      setIssueDraft(nextDraft);
    }

    void saveIssueDraft(issue, nextDraft).catch(() => {
      setError("Could not save the assignee.");
      void loadWorkspace();
    });
  };

  useEffect(() => {
    if (route.name !== "issue" || !selectedIssue || !canSaveIssue) {
      return;
    }

    if (isSameIssueDraft(selectedIssue, issueDraft)) {
      return;
    }

    if (immediateSaveKeyRef.current === getIssueDraftKey(issueDraft)) {
      return;
    }

    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = window.setTimeout(() => {
      void saveIssueDraft(selectedIssue, issueDraft).catch(() => {
        setError("Could not save the issue.");
      });
    }, 500);

    return () => {
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [canSaveIssue, issueDraft, route.name, saveIssueDraft, selectedIssue]);

  const handleDeleteIssue = async () => {
    if (!selectedIssue || !window.confirm("Delete this issue?")) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await authenticatedFetch(
        `/api/issues/${selectedIssue.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Delete issue request failed.");
      }

      setIssues((currentIssues) =>
        currentIssues.filter((issue) => issue.id !== selectedIssue.id),
      );
      navigate({ name: "issues" });
      await loadWorkspace();
    } catch {
      setError("Could not delete the issue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSaveProject) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await authenticatedFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectDraft),
      });

      if (!response.ok) {
        throw new Error("Create project request failed.");
      }

      const project = (await response.json()) as Project;
      setProjects((currentProjects) => [...currentProjects, project]);
      setIsCreatingProject(false);
      setProjectDraft(emptyProjectDraft);
      navigate({ name: "project", id: project.id });
    } catch {
      setError("Could not create the project.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedProject || !canSaveProject) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await authenticatedFetch(
        `/api/projects/${selectedProject.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(projectDraft),
        },
      );

      if (!response.ok) {
        throw new Error("Update project request failed.");
      }

      const project = (await response.json()) as Project;
      setSelectedProject(project);
      setProjects((currentProjects) =>
        currentProjects.map((currentProject) =>
          currentProject.id === project.id ? project : currentProject,
        ),
      );
    } catch {
      setError("Could not save the project.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyIssueUrl = async () => {
    if (!selectedIssue) {
      return;
    }

    const url = `${window.location.origin}/issues/${selectedIssue.id}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 1400);
    } catch {
      setError("Could not copy the issue URL.");
    }
  };

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <AuthGate
        authError={getAuthRedirectError()}
        onLogin={() => void loginWithRedirect()}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#08090a] text-zinc-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-zinc-900 bg-[#0c0d0e] px-3 py-4 md:block">
          <div className="mb-5 flex items-center gap-2 px-2">
            <div className="grid size-7 place-items-center rounded bg-emerald-500 text-xs font-black text-zinc-950">
              T
            </div>
            <div>
              <div className="text-sm font-semibold">Devs Team</div>
              <div className="text-xs text-zinc-500">
                {currentUser?.email || "Authenticated"}
              </div>
            </div>
          </div>
          <nav className="space-y-1">
            <NavButton
              active={route.name === "issues" || route.name === "issue"}
              icon={<Inbox />}
              label="Issues"
              onClick={() => navigate({ name: "issues" })}
            />
            <NavButton
              active={route.name === "projects" || route.name === "project"}
              icon={<FolderKanban />}
              label="Projects"
              onClick={() => navigate({ name: "projects" })}
            />
          </nav>
          <Separator className="my-4 bg-zinc-900" />
          <div className="px-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Assignees
          </div>
          <div className="mt-2 space-y-1">
            {owners.map((owner) => (
              <div
                key={owner.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-400"
              >
                <Avatar className="size-5 border border-zinc-800">
                  <AvatarFallback className="bg-zinc-900 text-[9px] text-zinc-400">
                    {owner.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{owner.name}</span>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-zinc-900 bg-[#0b0c0d]/95 backdrop-blur">
            <div className="flex min-h-14 items-center justify-between gap-3 px-4 md:px-6">
              <div className="flex min-w-0 items-center gap-3">
                {hasParentRoute ? (
                  <>
                    <button
                      type="button"
                      className="rounded text-sm text-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
                      onClick={() => navigate(parentRoute)}
                    >
                      {parentTitle}
                    </button>
                    <span className="text-zinc-700">/</span>
                  </>
                ) : null}
                <h1 className="truncate text-sm font-semibold">
                  {currentTitle}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 rounded text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                  aria-label="Sign out"
                  onClick={() =>
                    logout({
                      logoutParams: { returnTo: window.location.origin },
                    })
                  }
                >
                  <LogOut />
                </Button>
                <Button
                  size="sm"
                  className="h-8 rounded bg-zinc-100 text-zinc-950 hover:bg-white"
                  onClick={() => openNewIssue("Todo")}
                  disabled={projects.length === 0}
                >
                  <Plus />
                  Issue
                </Button>
              </div>
            </div>
          </header>

          <div className="">
            {error ? (
              <Alert className="mb-4 border-red-950 bg-red-950/30 text-red-100">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {isLoading ? (
              <div className="flex h-72 items-center justify-center text-zinc-500">
                <Loader2 className="mr-2 animate-spin" />
                Loading workspace
              </div>
            ) : null}

            {!isLoading && route.name === "issues" ? (
              <IssuesBoard
                groups={groupedIssues}
                owners={owners}
                issueFilter={issueFilter}
                showProject
                onIssueFilterChange={setIssueFilter}
                onCreateIssue={openNewIssue}
                onAssignOwner={handleAssignIssueOwner}
                onOpenIssue={(issue) =>
                  navigate({ name: "issue", id: issue.id })
                }
              />
            ) : null}

            {!isLoading && route.name === "projects" ? (
              <ProjectsList
                projects={projects}
                onCreateProject={() => {
                  setProjectDraft(emptyProjectDraft);
                  setIsCreatingProject(true);
                }}
                onOpenProject={(project) =>
                  navigate({ name: "project", id: project.id })
                }
              />
            ) : null}

            {!isLoading && route.name === "project" ? (
              <ProjectPage
                project={selectedProject}
                draft={projectDraft}
                groupedIssues={groupedIssues}
                owners={owners}
                issueFilter={issueFilter}
                isSubmitting={isSubmitting}
                canSave={canSaveProject}
                onDraftChange={setProjectDraft}
                onSubmit={handleUpdateProject}
                onIssueFilterChange={setIssueFilter}
                onCreateIssue={(status) => openNewIssue(status, route.id)}
                onAssignOwner={handleAssignIssueOwner}
                onOpenIssue={(issue) =>
                  navigate({ name: "issue", id: issue.id })
                }
              />
            ) : null}

            {!isLoading && route.name === "issue" ? (
              <IssuePage
                issue={selectedIssue}
                draft={issueDraft}
                projects={projects}
                owners={owners}
                isSubmitting={isSubmitting}
                copiedUrl={copiedUrl}
                onDraftChange={handleIssueDraftChange}
                onDelete={handleDeleteIssue}
                onCopyUrl={handleCopyIssueUrl}
                onOpenProject={(projectId) =>
                  navigate({ name: "project", id: projectId })
                }
              />
            ) : null}
          </div>
        </section>
      </div>

      <Dialog open={isCreatingIssue} onOpenChange={setIsCreatingIssue}>
        <DialogContent className="max-w-3xl border-zinc-800 bg-[#171819] p-0 text-zinc-100">
          <IssueForm
            title="New issue"
            description="Create a new issue inside a project."
            draft={issueDraft}
            projects={projects}
            owners={owners}
            isSubmitting={isSubmitting}
            canSave={canSaveIssue}
            submitLabel="Create issue"
            onDraftChange={setIssueDraft}
            onSubmit={handleCreateIssue}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isCreatingProject} onOpenChange={setIsCreatingProject}>
        <DialogContent className="border-zinc-800 bg-[#171819] text-zinc-100">
          <ProjectForm
            title="New project"
            draft={projectDraft}
            isSubmitting={isSubmitting}
            canSave={canSaveProject}
            submitLabel="Create project"
            onDraftChange={setProjectDraft}
            onSubmit={handleCreateProject}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}

function AuthLoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#08090a] text-zinc-100">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="animate-spin" />
        Loading session
      </div>
    </main>
  );
}

function AuthGate({
  authError,
  onLogin,
}: {
  authError: string | null;
  onLogin: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#08090a] px-5 text-zinc-100">
      <section className="w-full max-w-sm rounded border border-zinc-900 bg-[#0c0d0e] p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded bg-emerald-500 text-sm font-black text-zinc-950">
            T
          </div>
          <div>
            <h1 className="text-base font-semibold">Todo workspace</h1>
            <p className="text-sm text-zinc-500">Sign in to continue.</p>
          </div>
        </div>
        {authError ? (
          <Alert className="mb-4 border-red-950 bg-red-950/30 text-red-100">
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          className="h-9 w-full rounded bg-zinc-100 text-zinc-950 hover:bg-white"
          onClick={onLogin}
        >
          Continue with Google
        </Button>
      </section>
    </main>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
        active
          ? "bg-zinc-900 text-zinc-100"
          : "text-zinc-500 hover:bg-zinc-900/70 hover:text-zinc-200",
      )}
      onClick={onClick}
    >
      <span className="grid size-4 place-items-center [&_svg]:size-4">
        {icon}
      </span>
      {label}
    </button>
  );
}

function IssuesBoard({
  groups,
  owners,
  issueFilter,
  showProject,
  onIssueFilterChange,
  onCreateIssue,
  onAssignOwner,
  onOpenIssue,
}: {
  groups: { status: IssueStatus; issues: Issue[] }[];
  owners: Owner[];
  issueFilter: IssueFilter;
  showProject: boolean;
  onIssueFilterChange: (filter: IssueFilter) => void;
  onCreateIssue: (status: IssueStatus) => void;
  onAssignOwner: (issue: Issue, ownerId: string) => void;
  onOpenIssue: (issue: Issue) => void;
}) {
  const assigneeCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const group of groups) {
      for (const issue of group.issues) {
        const ownerId = issue.ownerId ?? "";
        counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1);
      }
    }

    return counts;
  }, [groups]);

  return (
    <div className="overflow-hidden rounded border border-zinc-900 bg-[#0c0d0e]">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-900 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
          {issueFilterOptions.map((option) => {
            const isSelected = issueFilter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "h-7 shrink-0 rounded-full border px-3 text-xs font-medium transition",
                  isSelected
                    ? "border-zinc-700 bg-zinc-800 text-zinc-50"
                    : "border-zinc-800 bg-[#111213] text-zinc-400 hover:border-zinc-700 hover:text-zinc-100",
                )}
                onClick={() => onIssueFilterChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 shrink-0 rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
          aria-label="Toggle side panel"
        >
          <PanelRight className="size-4" />
        </Button>
      </div>

      {groups.map(({ status, issues }) => (
        <section key={status}>
          <div className="flex items-center justify-between border-b border-zinc-900 bg-[#111213] px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {getStatusIcon(status)}
              <span>{status}</span>
              <span className="text-xs text-zinc-600">{issues.length}</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
              aria-label={`Create issue in ${status}`}
              onClick={() => onCreateIssue(status)}
            >
              <Plus />
            </Button>
          </div>
          <div>
            {issues.length === 0 ? (
              <div className="border-b border-zinc-900 px-4 py-4 text-sm text-zinc-600">
                No issues
              </div>
            ) : (
              issues.map((issue) => (
                <div
                  key={issue.id}
                  className="grid w-full grid-cols-1 gap-2 border-b border-zinc-900 px-4 py-3 text-left hover:bg-zinc-900/50 md:grid-cols-[1fr_auto]"
                >
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-2 text-left"
                    onClick={() => onOpenIssue(issue)}
                  >
                    {getStatusIcon(issue.status, "shrink-0")}
                    <span className="shrink-0 text-xs font-medium text-zinc-500">
                      {issue.code}
                    </span>
                    <span className="truncate text-sm font-medium text-zinc-100">
                      {issue.title}
                    </span>
                    {showProject ? (
                      <Badge
                        variant="outline"
                        className="hidden shrink-0 border-zinc-800 text-zinc-500 md:inline-flex"
                      >
                        {issue.projectName}
                      </Badge>
                    ) : null}
                  </button>
                  <div className="flex items-center gap-2 md:justify-end">
                    <QuickAssigneeMenu
                      issue={issue}
                      owners={owners}
                      assigneeCounts={assigneeCounts}
                      onAssignOwner={onAssignOwner}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function QuickAssigneeMenu({
  issue,
  owners,
  assigneeCounts,
  onAssignOwner,
}: {
  issue: Issue;
  owners: Owner[];
  assigneeCounts: Map<string, number>;
  onAssignOwner: (issue: Issue, ownerId: string) => void;
}) {
  const selectedOwnerId = issue.ownerId ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full p-0 hover:bg-zinc-800"
          aria-label={`Assign owner for ${issue.code}`}
        >
          <AssigneeAvatar owner={issue.owner} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 rounded-lg border-zinc-800 bg-[#202123] p-1 text-zinc-100 shadow-xl"
      >
        <DropdownMenuItem
          className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm font-semibold focus:bg-zinc-700"
          onSelect={() => onAssignOwner(issue, "")}
        >
          <UsersRound className="size-4 text-zinc-300" />
          <span className="min-w-0 flex-1 truncate">No assignee</span>
          {selectedOwnerId === "" ? <Check className="size-4" /> : null}
          <span className="text-xs text-zinc-500">
            {assigneeCounts.get("") ?? 0}
          </span>
        </DropdownMenuItem>
        {owners.map((owner) => (
          <DropdownMenuItem
            key={owner.id}
            className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm font-semibold focus:bg-zinc-700"
            onSelect={() => onAssignOwner(issue, owner.id)}
          >
            <Avatar className="size-4 border border-zinc-700">
              <AvatarFallback className="bg-yellow-400 text-[8px] font-bold text-zinc-950">
                {owner.initials}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate">{owner.name}</span>
            {selectedOwnerId === owner.id ? <Check className="size-4" /> : null}
            <span className="text-xs text-zinc-500">
              {assigneeCounts.get(owner.id) ?? 0}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="mx-2 bg-zinc-700/70" />
        <DropdownMenuLabel className="px-2 py-1 text-xs font-medium text-zinc-400">
          New user
        </DropdownMenuLabel>
        <DropdownMenuItem
          disabled
          className="flex h-8 items-center gap-2 rounded-md px-2 text-sm font-semibold text-zinc-400 opacity-70"
        >
          <Send className="size-4" />
          <span className="min-w-0 flex-1 truncate">Invite and assign...</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectsList({
  projects,
  onCreateProject,
  onOpenProject,
}: {
  projects: Project[];
  onCreateProject: () => void;
  onOpenProject: (project: Project) => void;
}) {
  return (
    <div className="overflow-hidden rounded border border-zinc-900 bg-[#0c0d0e]">
      <div className="flex items-center justify-between border-b border-zinc-900 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Projects</h2>
          <p className="text-xs text-zinc-500">Only the useful fields.</p>
        </div>
        <Button
          size="sm"
          className="h-8 rounded bg-zinc-100 text-zinc-950 hover:bg-white"
          onClick={onCreateProject}
        >
          <Plus />
          Project
        </Button>
      </div>
      <div className="grid grid-cols-[1fr_120px_120px] border-b border-zinc-900 px-4 py-2 text-xs text-zinc-600">
        <span>Name</span>
        <span>Issues</span>
        <span>Progress</span>
      </div>
      {projects.map((project) => (
        <button
          key={project.id}
          type="button"
          className="grid w-full grid-cols-[1fr_120px_120px] items-center border-b border-zinc-900 px-4 py-3 text-left text-sm hover:bg-zinc-900/50"
          onClick={() => onOpenProject(project)}
        >
          <span className="flex min-w-0 items-center gap-2 font-medium">
            <FolderKanban className="size-4 text-zinc-500" />
            <span className="truncate">{project.name}</span>
          </span>
          <span className="text-zinc-400">{project.issueCount}</span>
          <span className="text-zinc-400">
            {project.issueCount === 0
              ? "0%"
              : `${Math.round((project.doneIssueCount / project.issueCount) * 100)}%`}
          </span>
        </button>
      ))}
    </div>
  );
}

function ProjectPage({
  project,
  draft,
  groupedIssues,
  owners,
  issueFilter,
  isSubmitting,
  canSave,
  onDraftChange,
  onSubmit,
  onIssueFilterChange,
  onCreateIssue,
  onAssignOwner,
  onOpenIssue,
}: {
  project: Project | null;
  draft: ProjectDraft;
  groupedIssues: { status: IssueStatus; issues: Issue[] }[];
  owners: Owner[];
  issueFilter: IssueFilter;
  isSubmitting: boolean;
  canSave: boolean;
  onDraftChange: (draft: ProjectDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onIssueFilterChange: (filter: IssueFilter) => void;
  onCreateIssue: (status: IssueStatus) => void;
  onAssignOwner: (issue: Issue, ownerId: string) => void;
  onOpenIssue: (issue: Issue) => void;
}) {
  if (!project) {
    return <EmptyState label="Project not found" />;
  }

  return (
    <div className="space-y-5">
      <form
        className="rounded border border-zinc-900 bg-[#0c0d0e] p-4"
        onSubmit={onSubmit}
      >
        <Input
          className="h-auto border-0 bg-transparent px-0 text-2xl font-semibold text-zinc-100 shadow-none focus-visible:ring-0"
          value={draft.name}
          onChange={(event) =>
            onDraftChange({ ...draft, name: event.target.value })
          }
          disabled={isSubmitting}
        />
        <Textarea
          className="mt-2 min-h-20 resize-none border-0 bg-transparent px-0 text-sm text-zinc-400 shadow-none focus-visible:ring-0"
          value={draft.description}
          onChange={(event) =>
            onDraftChange({ ...draft, description: event.target.value })
          }
          placeholder="Project description"
          disabled={isSubmitting}
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            {project.issueCount} issues · {project.doneIssueCount} done
          </div>
          <Button
            type="submit"
            size="sm"
            className="h-8 rounded bg-zinc-100 text-zinc-950 hover:bg-white"
            disabled={isSubmitting || !canSave}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </div>
      </form>
      <IssuesBoard
        groups={groupedIssues}
        owners={owners}
        issueFilter={issueFilter}
        showProject={false}
        onIssueFilterChange={onIssueFilterChange}
        onCreateIssue={onCreateIssue}
        onAssignOwner={onAssignOwner}
        onOpenIssue={onOpenIssue}
      />
    </div>
  );
}

function IssuePage({
  issue,
  draft,
  projects,
  owners,
  isSubmitting,
  copiedUrl,
  onDraftChange,
  onDelete,
  onCopyUrl,
  onOpenProject,
}: {
  issue: Issue | null;
  draft: IssueDraft;
  projects: Project[];
  owners: Owner[];
  isSubmitting: boolean;
  copiedUrl: boolean;
  onDraftChange: (draft: IssueDraft, saveImmediately?: boolean) => void;
  onDelete: () => void;
  onCopyUrl: () => void;
  onOpenProject: (projectId: string) => void;
}) {
  if (!issue) {
    return <EmptyState label="Issue not found" />;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0 rounded border border-zinc-900 bg-[#0c0d0e] p-5">
        <div className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
          <span>{issue.projectName}</span>
          <span>/</span>
          <span>{issue.code}</span>
        </div>
        <Input
          className="h-auto border-0 bg-transparent px-0 text-3xl font-semibold text-zinc-100 shadow-none focus-visible:ring-0"
          value={draft.title}
          onChange={(event) =>
            onDraftChange({ ...draft, title: event.target.value })
          }
          disabled={isSubmitting}
        />
        <Textarea
          className="mt-5 min-h-80 resize-none border-0 bg-transparent px-0 text-sm leading-6 text-zinc-300 shadow-none focus-visible:ring-0"
          value={draft.description}
          onChange={(event) =>
            onDraftChange({ ...draft, description: event.target.value })
          }
          placeholder="Add description..."
          disabled={isSubmitting}
        />
      </section>

      <aside className="space-y-3">
        <div className="rounded border border-zinc-900 bg-[#0c0d0e] p-3">
          <div className="mb-3 flex items-center justify-between">
            <Badge
              variant="outline"
              className={cn(
                "gap-2 rounded border px-2 py-1",
                getStatusTone(draft.status),
              )}
            >
              {getStatusIcon(draft.status)}
              {draft.status}
            </Badge>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 rounded text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
              aria-label="Copy issue URL"
              onClick={onCopyUrl}
            >
              <Link2 />
            </Button>
          </div>
          {copiedUrl ? (
            <div className="mb-3 rounded bg-emerald-950/40 px-2 py-1 text-xs text-emerald-200">
              Issue URL copied
            </div>
          ) : null}
          <FieldLabel label="Status">
            <Select
              value={draft.status}
              onValueChange={(value) =>
                onDraftChange({ ...draft, status: value as IssueStatus }, true)
              }
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-8 border-zinc-800 bg-zinc-950 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-[#171819] text-zinc-100">
                <SelectGroup>
                  {issueStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      <span className="flex items-center gap-2">
                        {getStatusIcon(status)}
                        {status}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldLabel>
          <FieldLabel label="Assignee">
            <OwnerSelect
              value={draft.ownerId}
              owners={owners}
              disabled={isSubmitting}
              onChange={(ownerId) => onDraftChange({ ...draft, ownerId }, true)}
            />
          </FieldLabel>
          <FieldLabel label="Project">
            <Select
              value={draft.projectId}
              onValueChange={(projectId) =>
                onDraftChange({ ...draft, projectId }, true)
              }
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-8 border-zinc-800 bg-zinc-950 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-[#171819] text-zinc-100">
                <SelectGroup>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldLabel>
        </div>
        <div className="rounded border border-zinc-900 bg-[#0c0d0e] p-3">
          <Button
            type="button"
            variant="ghost"
            className="mb-2 h-8 w-full justify-start rounded text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            onClick={() => onOpenProject(draft.projectId)}
          >
            <FolderKanban />
            Open project
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-full justify-start rounded text-red-300 hover:bg-red-950/30 hover:text-red-100"
            onClick={onDelete}
            disabled={isSubmitting}
          >
            <Trash2 />
            Delete issue
          </Button>
        </div>
      </aside>
    </div>
  );
}

function IssueForm({
  title,
  description,
  draft,
  projects,
  owners,
  isSubmitting,
  canSave,
  submitLabel,
  onDraftChange,
  onSubmit,
}: {
  title: string;
  description: string;
  draft: IssueDraft;
  projects: Project[];
  owners: Owner[];
  isSubmitting: boolean;
  canSave: boolean;
  submitLabel: string;
  onDraftChange: (draft: IssueDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <DialogHeader className="border-b border-zinc-900 px-5 py-4">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="text-zinc-500">
          {description}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 px-5 py-5">
        <Input
          className="h-auto border-0 bg-transparent px-0 text-2xl font-semibold text-zinc-100 shadow-none focus-visible:ring-0"
          value={draft.title}
          onChange={(event) =>
            onDraftChange({ ...draft, title: event.target.value })
          }
          placeholder="Issue title"
          disabled={isSubmitting}
          autoFocus
        />
        <Textarea
          className="min-h-28 resize-none border-0 bg-transparent px-0 text-sm text-zinc-300 shadow-none focus-visible:ring-0"
          value={draft.description}
          onChange={(event) =>
            onDraftChange({ ...draft, description: event.target.value })
          }
          placeholder="Add description..."
          disabled={isSubmitting}
        />
        <div className="grid gap-2 md:grid-cols-3">
          <Select
            value={draft.status}
            onValueChange={(value) =>
              onDraftChange({ ...draft, status: value as IssueStatus })
            }
            disabled={isSubmitting}
          >
            <SelectTrigger className="h-9 border-zinc-800 bg-zinc-950 text-zinc-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-[#171819] text-zinc-100">
              <SelectGroup>
                {issueStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    <span className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      {status}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={draft.projectId}
            onValueChange={(projectId) =>
              onDraftChange({ ...draft, projectId })
            }
            disabled={isSubmitting}
          >
            <SelectTrigger className="h-9 border-zinc-800 bg-zinc-950 text-zinc-100">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-[#171819] text-zinc-100">
              <SelectGroup>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <OwnerSelect
            value={draft.ownerId}
            owners={owners}
            disabled={isSubmitting}
            onChange={(ownerId) => onDraftChange({ ...draft, ownerId })}
          />
        </div>
      </div>
      <DialogFooter className="border-t border-zinc-900 px-5 py-4">
        <Button
          type="submit"
          className="rounded bg-zinc-100 text-zinc-950 hover:bg-white"
          disabled={isSubmitting || !canSave}
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : null}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ProjectForm({
  title,
  draft,
  isSubmitting,
  canSave,
  submitLabel,
  onDraftChange,
  onSubmit,
}: {
  title: string;
  draft: ProjectDraft;
  isSubmitting: boolean;
  canSave: boolean;
  submitLabel: string;
  onDraftChange: (draft: ProjectDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="text-zinc-500">
          Projects collect their own issues.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4 space-y-3">
        <Input
          className="border-zinc-800 bg-zinc-950 text-zinc-100"
          value={draft.name}
          onChange={(event) =>
            onDraftChange({ ...draft, name: event.target.value })
          }
          placeholder="Project name"
          disabled={isSubmitting}
          autoFocus
        />
        <Textarea
          className="min-h-24 resize-none border-zinc-800 bg-zinc-950 text-zinc-100"
          value={draft.description}
          onChange={(event) =>
            onDraftChange({ ...draft, description: event.target.value })
          }
          placeholder="Description"
          disabled={isSubmitting}
        />
      </div>
      <DialogFooter className="mt-5">
        <Button
          type="submit"
          className="rounded bg-zinc-100 text-zinc-950 hover:bg-white"
          disabled={isSubmitting || !canSave}
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : null}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

function OwnerSelect({
  value,
  owners,
  disabled,
  onChange,
}: {
  value: string;
  owners: Owner[];
  disabled: boolean;
  onChange: (ownerId: string) => void;
}) {
  return (
    <Select
      value={value || unassignedValue}
      onValueChange={(ownerId) =>
        onChange(ownerId === unassignedValue ? "" : ownerId)
      }
      disabled={disabled}
    >
      <SelectTrigger className="h-9 border-zinc-800 bg-zinc-950 text-zinc-100">
        <UserRound className="size-4 text-zinc-500" />
        <SelectValue placeholder="Assignee" />
      </SelectTrigger>
      <SelectContent className="border-zinc-800 bg-[#171819] text-zinc-100">
        <SelectGroup>
          <SelectItem value={unassignedValue}>Unassigned</SelectItem>
          {owners.map((owner) => (
            <SelectItem key={owner.id} value={owner.id}>
              {owner.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="mt-3 grid gap-1">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function AssigneeAvatar({ owner }: { owner: Owner | null }) {
  return (
    <Avatar className="size-7 border border-zinc-800 bg-zinc-950">
      <AvatarFallback className="bg-zinc-950 text-[10px] font-semibold text-zinc-400">
        {owner?.initials ?? <UsersRound className="size-3" />}
      </AvatarFallback>
    </Avatar>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="grid h-72 place-items-center rounded border border-zinc-900 bg-[#0c0d0e] text-sm text-zinc-500">
      {label}
    </div>
  );
}

function toIssueDraft(issue: Issue): IssueDraft {
  return {
    title: issue.title,
    description: issue.description,
    status: issue.status,
    projectId: issue.projectId,
    ownerId: issue.ownerId ?? "",
  };
}

function toIssuePayload(draft: IssueDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    status: draft.status,
    projectId: draft.projectId,
    ownerId: draft.ownerId || null,
  };
}

function isSameIssueDraft(issue: Issue, draft: IssueDraft) {
  const payload = toIssuePayload(draft);

  return (
    issue.title === payload.title &&
    issue.description === payload.description &&
    issue.status === payload.status &&
    issue.projectId === payload.projectId &&
    issue.ownerId === payload.ownerId
  );
}

function getIssueDraftKey(draft: IssueDraft) {
  return JSON.stringify(toIssuePayload(draft));
}

function mergeIssues(currentIssues: Issue[], nextIssues: Issue[]) {
  const issueById = new Map(currentIssues.map((issue) => [issue.id, issue]));

  for (const issue of nextIssues) {
    issueById.set(issue.id, issue);
  }

  return Array.from(issueById.values()).sort(
    (left, right) => left.issueNumber - right.issueNumber,
  );
}

export default App;
