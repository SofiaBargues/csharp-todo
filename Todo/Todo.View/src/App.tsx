import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  CircleDashed,
  Layers3,
  Loader2,
  Maximize2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  SlidersHorizontal,
  Tag,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type EditState = {
  id: string;
  title: string;
  section: string;
  dueDate: string;
  isCompleted: boolean;
} | null;

type TodoItem = {
  id: string;
  title: string;
  isCompleted: boolean;
  section: string;
  dueDate: string | null;
  createdAtUtc: string;
};

type ViewFilter = {
  id: string;
  label: string;
  kind: "all" | "active" | "section";
  value?: string;
};

type NewIssueState = {
  isOpen: boolean;
  title: string;
  description: string;
  section: string;
  dueDate: string;
  status: "pending" | "completed";
};

const baseViews: ViewFilter[] = [
  { id: "all", label: "All issues", kind: "all" },
  { id: "active", label: "Active", kind: "active" },
  { id: "backlog", label: "Backlog", kind: "section", value: "Backlog" },
];

const customViewsKey = "todo.customViews";
const groupOrder = ["In Progress", "Todo", "Backlog", "Done"];

const emptyIssue: NewIssueState = {
  isOpen: false,
  title: "",
  description: "",
  section: "Todo",
  dueDate: "",
  status: "pending",
};

const formatDueDate = (dueDate: string | null) => {
  if (!dueDate) {
    return "No date";
  }

  const [year, month, day] = dueDate.split("-");

  if (!year || !month || !day) {
    return dueDate;
  }

  return `${month}/${day}/${year}`;
};

const normalize = (value: string) => value.trim().toLowerCase();

const getSectionLabel = (todo: TodoItem) => todo.section.trim() || "Todo";

const getGroupLabel = (todo: TodoItem) =>
  todo.isCompleted ? "Done" : getSectionLabel(todo);

const getDefaultSectionForView = (view: ViewFilter) => {
  if (view.kind === "section") {
    return view.value ?? view.label;
  }

  return "Todo";
};

const getGroupIcon = (label: string) => {
  const normalizedLabel = normalize(label);

  if (normalizedLabel === "done") {
    return <CheckCircle2 className="size-4 text-indigo-400" />;
  }

  if (normalizedLabel === "backlog") {
    return <CircleDashed className="size-4 text-zinc-400" />;
  }

  if (normalizedLabel.includes("progress")) {
    return <CircleDashed className="size-4 text-yellow-400" />;
  }

  return <Circle className="size-4 text-zinc-300" />;
};

const sortGroups = (left: string, right: string) => {
  const leftIndex = groupOrder.findIndex(
    (label) => normalize(label) === normalize(left),
  );
  const rightIndex = groupOrder.findIndex(
    (label) => normalize(label) === normalize(right),
  );

  if (leftIndex >= 0 || rightIndex >= 0) {
    return (
      (leftIndex === -1 ? 99 : leftIndex) -
      (rightIndex === -1 ? 99 : rightIndex)
    );
  }

  return left.localeCompare(right);
};

function App() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeViewId, setActiveViewId] = useState("all");
  const [customViews, setCustomViews] = useState<ViewFilter[]>(() => {
    const storedViews = window.localStorage.getItem(customViewsKey);

    if (!storedViews) {
      return [];
    }

    try {
      const parsedViews = JSON.parse(storedViews) as ViewFilter[];

      return parsedViews.filter(
        (view) => view.kind === "section" && view.label.trim(),
      );
    } catch {
      return [];
    }
  });
  const [isAddingView, setIsAddingView] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newIssue, setNewIssue] = useState<NewIssueState>(emptyIssue);

  useEffect(() => {
    const loadTodos = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/todos");

        if (!response.ok) {
          throw new Error("Could not load tasks.");
        }

        const data = (await response.json()) as TodoItem[];
        setTodos(data);
      } catch {
        setError(
          "Could not connect to the API. Make sure the backend is running.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadTodos();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(customViewsKey, JSON.stringify(customViews));
  }, [customViews]);

  const views = useMemo(() => [...baseViews, ...customViews], [customViews]);
  const activeView = views.find((view) => view.id === activeViewId) ?? views[0];

  const filteredTodos = todos.filter((todo) => {
    if (activeView.kind === "active") {
      return !todo.isCompleted;
    }

    if (activeView.kind === "section") {
      return (
        normalize(getSectionLabel(todo)) ===
        normalize(activeView.value ?? activeView.label)
      );
    }

    return true;
  });

  const groupedTodos = useMemo(() => {
    const groups = filteredTodos.reduce<Record<string, TodoItem[]>>(
      (result, todo) => {
        const groupLabel = getGroupLabel(todo);
        result[groupLabel] = [...(result[groupLabel] ?? []), todo];
        return result;
      },
      {},
    );

    return Object.entries(groups).sort(([left], [right]) =>
      sortGroups(left, right),
    );
  }, [filteredTodos]);

  const canCreateIssue = Boolean(
    newIssue.title.trim() && newIssue.section.trim() && newIssue.dueDate,
  );

  const handleAddView = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const label = newViewName.trim();

    if (!label) {
      return;
    }

    const existingView = views.find(
      (view) => normalize(view.label) === normalize(label),
    );

    if (existingView) {
      setActiveViewId(existingView.id);
      setNewViewName("");
      setIsAddingView(false);
      return;
    }

    const nextView: ViewFilter = {
      id: `section-${crypto.randomUUID()}`,
      label,
      kind: "section",
      value: label,
    };

    setCustomViews((currentViews) => [...currentViews, nextView]);
    setActiveViewId(nextView.id);
    setNewViewName("");
    setIsAddingView(false);
  };

  const handleRemoveView = (id: string) => {
    setCustomViews((currentViews) =>
      currentViews.filter((view) => view.id !== id),
    );

    if (activeViewId === id) {
      setActiveViewId("all");
    }
  };

  const toggleGroup = (groupLabel: string) => {
    setCollapsedGroups((currentGroups) => {
      const nextGroups = new Set(currentGroups);

      if (nextGroups.has(groupLabel)) {
        nextGroups.delete(groupLabel);
      } else {
        nextGroups.add(groupLabel);
      }

      return nextGroups;
    });
  };

  const openNewIssueModal = (groupLabel?: string) => {
    const normalizedGroup = normalize(groupLabel ?? "");
    const isDoneGroup = normalizedGroup === "done";
    const sectionLabel =
      groupLabel && !isDoneGroup ? groupLabel : getDefaultSectionForView(activeView);

    setNewIssue({
      isOpen: true,
      title: "",
      description: "",
      section: sectionLabel,
      dueDate: "",
      status: isDoneGroup ? "completed" : "pending",
    });
  };

  const closeNewIssueModal = () => {
    if (isSubmitting) {
      return;
    }

    setNewIssue(emptyIssue);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/todos/${id}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error();
      }

      setTodos((currentTodos: TodoItem[]) =>
        currentTodos.filter((todo: TodoItem) => todo.id !== id),
      );
    } catch {
      setError("Could not delete the task.");
    }
  };

  const startEdit = (todo: TodoItem) => {
    setEditState({
      id: todo.id,
      title: todo.title,
      section: todo.section,
      dueDate: todo.dueDate ?? "",
      isCompleted: todo.isCompleted,
    });
  };

  const cancelEdit = () => {
    setEditState(null);
  };

  const handleCreateIssue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextTitle = newIssue.title.trim();
    const nextSection = newIssue.section.trim();

    if (!nextTitle || !nextSection || !newIssue.dueDate) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch("/api/todos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: nextTitle,
          section: nextSection,
          dueDate: newIssue.dueDate,
          isCompleted: newIssue.status === "completed",
        }),
      });

      if (!response.ok) {
        throw new Error("Could not save the task.");
      }

      const createdTodo = (await response.json()) as TodoItem;

      setTodos((currentTodos: TodoItem[]) => [...currentTodos, createdTodo]);
      setNewIssue(emptyIssue);
    } catch {
      setError(
        "Could not save the task. Check that the API is still available.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editState) {
      return;
    }

    const nextTitle = editState.title.trim();
    const nextSection = editState.section.trim();

    if (!nextTitle || !nextSection || !editState.dueDate) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch(`/api/todos/${editState.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: nextTitle,
          section: nextSection,
          dueDate: editState.dueDate,
          isCompleted: editState.isCompleted,
        }),
      });

      if (!response.ok) {
        throw new Error();
      }

      const updatedTodo = (await response.json()) as TodoItem;

      setTodos((currentTodos: TodoItem[]) =>
        currentTodos.map((todo: TodoItem) =>
          todo.id === updatedTodo.id ? updatedTodo : todo,
        ),
      );
      setEditState(null);
    } catch {
      setError("Could not update the task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0f1012] text-zinc-100">
      <section className="mx-auto flex w-full max-w-6xl flex-col px-3 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2 pb-2">
          {views.map((view) => {
            const isCustomView = customViews.some(
              (customView) => customView.id === view.id,
            );

            return (
              <div
                key={view.id}
                className={cn(
                  "inline-flex h-8 items-center overflow-hidden rounded-full border text-sm font-medium transition-colors",
                  activeViewId === view.id
                    ? "border-zinc-600 bg-zinc-900 text-zinc-100"
                    : "border-zinc-800 bg-transparent text-zinc-400 hover:border-zinc-700 hover:text-zinc-100",
                )}
              >
                <button
                  type="button"
                  className="h-full px-3"
                  onClick={() => setActiveViewId(view.id)}
                >
                  {view.label}
                </button>
                {isCustomView ? (
                  <button
                    type="button"
                    className="flex h-full w-7 items-center justify-center border-l border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
                    aria-label={`Remove ${view.label} view`}
                    onClick={() => handleRemoveView(view.id)}
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })}

          {isAddingView ? (
            <form
              className="flex h-8 items-center gap-1 rounded-full border border-dashed border-zinc-700 bg-zinc-950 px-2"
              onSubmit={handleAddView}
            >
              <Layers3 className="size-4 text-zinc-500" />
              <input
                className="h-6 w-28 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                value={newViewName}
                onChange={(event) => setNewViewName(event.target.value)}
                placeholder="New view"
                autoFocus
              />
              <button
                type="submit"
                className="text-zinc-500 hover:text-zinc-200 disabled:opacity-40"
                aria-label="Save new view"
                disabled={!newViewName.trim()}
              >
                <CheckCircle2 className="size-3.5" />
              </button>
              <button
                type="button"
                className="text-zinc-500 hover:text-zinc-200"
                aria-label="Cancel new view"
                onClick={() => {
                  setIsAddingView(false);
                  setNewViewName("");
                }}
              >
                <X className="size-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-full border border-dashed border-zinc-800 px-3 text-sm font-medium text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-200"
              onClick={() => setIsAddingView(true)}
            >
              <Layers3 className="size-4" />
              New view
              <Pencil className="size-3" />
            </button>
          )}
        </div>

        {error ? (
          <div className="mt-3 rounded-md border border-red-900/60 bg-red-950/40 p-4 text-sm font-medium text-red-200">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-zinc-800 bg-[#171719] p-4 text-sm text-zinc-400">
            <Loader2 className="size-4 animate-spin" />
            Loading tasks...
          </div>
        ) : null}

        {!isLoading && !error ? (
          <div className="mt-3 space-y-2">
            {filteredTodos.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
                No tasks in this view.
              </div>
            ) : null}

            {groupedTodos.map(([groupLabel, groupTodos]) => {
              const isCollapsed = collapsedGroups.has(groupLabel);

              return (
                <section
                  key={groupLabel}
                  className="overflow-hidden rounded-md border border-zinc-900"
                >
                  <header className="flex h-9 items-center justify-between bg-[#171719] px-3 text-sm">
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-2 font-semibold text-zinc-200 hover:text-white"
                      aria-expanded={!isCollapsed}
                      aria-label={`Toggle ${groupLabel}`}
                      onClick={() => toggleGroup(groupLabel)}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="size-4 text-zinc-600" />
                      ) : (
                        <ChevronDown className="size-4 text-zinc-600" />
                      )}
                      {getGroupIcon(groupLabel)}
                      <span className="truncate">{groupLabel}</span>
                      <span className="font-normal text-zinc-500">
                        {groupTodos.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="text-zinc-500 hover:text-zinc-200"
                      aria-label={`Add task to ${groupLabel}`}
                      onClick={() => openNewIssueModal(groupLabel)}
                    >
                      <Plus className="size-4" />
                    </button>
                  </header>

                  <div
                    className={cn(
                      "divide-y divide-zinc-900 bg-[#0f1012]",
                      isCollapsed && "hidden",
                    )}
                  >
                    {groupTodos.map((todo: TodoItem) => {
                      const sectionLabel = getSectionLabel(todo);
                      const dueDateLabel = formatDueDate(todo.dueDate);
                      const issueNumber = todo.id.slice(0, 4).toUpperCase();

                      return (
                        <div
                          key={todo.id}
                          className="px-3 py-3 hover:bg-zinc-900/55"
                        >
                          {editState && editState.id === todo.id ? (
                            <form
                              className="grid gap-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(10rem,0.7fr)_minmax(9rem,0.6fr)_auto_auto]"
                              onSubmit={handleEditSubmit}
                            >
                              <Input
                                type="text"
                                className="border-zinc-800 bg-[#111113] text-zinc-100"
                                value={editState.title}
                                onChange={(event) =>
                                  setEditState({
                                    ...editState,
                                    title: event.target.value,
                                  })
                                }
                                disabled={isSubmitting}
                              />
                              <Input
                                type="text"
                                className="border-zinc-800 bg-[#111113] text-zinc-100"
                                value={editState.section}
                                onChange={(event) =>
                                  setEditState({
                                    ...editState,
                                    section: event.target.value,
                                  })
                                }
                                disabled={isSubmitting}
                              />
                              <Input
                                type="date"
                                aria-label="Due Date"
                                className="border-zinc-800 bg-[#111113] text-zinc-100"
                                value={editState.dueDate}
                                onChange={(event) =>
                                  setEditState({
                                    ...editState,
                                    dueDate: event.target.value,
                                  })
                                }
                                disabled={isSubmitting}
                              />
                              <Select
                                value={
                                  editState.isCompleted
                                    ? "completed"
                                    : "pending"
                                }
                                onChange={(event) =>
                                  setEditState({
                                    ...editState,
                                    isCompleted:
                                      event.target.value === "completed",
                                  })
                                }
                                disabled={isSubmitting}
                                aria-label="Status"
                                className="border-zinc-800 bg-[#111113] text-zinc-100"
                              >
                                <option value="pending">Pending</option>
                                <option value="completed">Done</option>
                              </Select>
                              <Button
                                type="submit"
                                disabled={
                                  isSubmitting ||
                                  !editState.title.trim() ||
                                  !editState.section.trim() ||
                                  !editState.dueDate
                                }
                              >
                                Save
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={cancelEdit}
                                disabled={isSubmitting}
                              >
                                <X />
                                Cancel
                              </Button>
                            </form>
                          ) : (
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                                <span className="font-mono text-zinc-600">
                                  ---
                                </span>
                                <span className="font-medium text-zinc-500">
                                  SOF-{issueNumber}
                                </span>
                                {getGroupIcon(groupLabel)}
                                <h2 className="min-w-0 break-words font-semibold text-zinc-100">
                                  {todo.title}
                                </h2>
                                <span className="rounded-sm border border-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">
                                  {sectionLabel}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center justify-between gap-2 text-sm text-zinc-500 md:justify-end">
                                <span className="inline-flex items-center gap-1">
                                  <UsersRound className="size-4" />
                                  {dueDateLabel}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="View options"
                                  className="text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
                                >
                                  <SlidersHorizontal />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Edit task"
                                  className="text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
                                  onClick={() => startEdit(todo)}
                                  disabled={isSubmitting}
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Delete task"
                                  className="text-zinc-500 hover:bg-zinc-800 hover:text-red-300"
                                  onClick={() => handleDelete(todo.id)}
                                  disabled={isSubmitting}
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}
      </section>

      {newIssue.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-3 py-5 sm:py-8">
          <form
            className="flex min-h-[16rem] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#1d1d1f] shadow-2xl"
            onSubmit={handleCreateIssue}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-emerald-300">
                  SOF
                </span>
                <ChevronRight className="size-4 text-zinc-500" />
                <span>New issue</span>
              </div>
              <div className="flex items-center gap-1 text-zinc-500">
                <button
                  type="button"
                  className="rounded-md p-1.5 hover:bg-zinc-800 hover:text-zinc-100"
                  aria-label="Expand issue modal"
                >
                  <Maximize2 className="size-4" />
                </button>
                <button
                  type="button"
                  className="rounded-md p-1.5 hover:bg-zinc-800 hover:text-zinc-100"
                  aria-label="Close new issue"
                  onClick={closeNewIssueModal}
                  disabled={isSubmitting}
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-4 px-5 py-5">
              <input
                className="w-full bg-transparent text-xl font-semibold text-zinc-100 outline-none placeholder:text-zinc-500"
                value={newIssue.title}
                onChange={(event) =>
                  setNewIssue((currentIssue) => ({
                    ...currentIssue,
                    title: event.target.value,
                  }))
                }
                placeholder="Issue title"
                autoFocus
                disabled={isSubmitting}
              />
              <textarea
                className="min-h-20 w-full resize-none bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
                value={newIssue.description}
                onChange={(event) =>
                  setNewIssue((currentIssue) => ({
                    ...currentIssue,
                    description: event.target.value,
                  }))
                }
                placeholder="Add description..."
                disabled={isSubmitting}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  className="h-8 w-auto rounded-full border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-100"
                  value={newIssue.status}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setNewIssue((currentIssue) => ({
                      ...currentIssue,
                      status:
                        event.target.value === "completed"
                          ? "completed"
                          : "pending",
                    }))
                  }
                  aria-label="Issue status"
                  disabled={isSubmitting}
                >
                  <option value="pending">In Progress</option>
                  <option value="completed">Done</option>
                </Select>
                <Input
                  className="h-8 w-36 rounded-full border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-100 placeholder:text-zinc-500"
                  value={newIssue.section}
                  onChange={(event) =>
                    setNewIssue((currentIssue) => ({
                      ...currentIssue,
                      section: event.target.value,
                    }))
                  }
                  placeholder="Section"
                  disabled={isSubmitting}
                />
                <Input
                  className="h-8 w-40 rounded-full border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-100"
                  type="date"
                  value={newIssue.dueDate}
                  onChange={(event) =>
                    setNewIssue((currentIssue) => ({
                      ...currentIssue,
                      dueDate: event.target.value,
                    }))
                  }
                  aria-label="Issue due date"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-3 text-xs font-semibold text-zinc-400"
                >
                  <UsersRound className="size-3.5" />
                  Assignee
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-3 text-xs font-semibold text-zinc-400"
                >
                  <Tag className="size-3.5" />
                  Labels
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400"
                  aria-label="More issue options"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-3">
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                aria-label="Attach file"
              >
                <Paperclip className="size-4" />
              </button>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  <input
                    type="checkbox"
                    className="size-4 accent-indigo-500"
                    disabled
                  />
                  Create more
                </label>
                <Button
                  type="submit"
                  disabled={isSubmitting || !canCreateIssue}
                  className="h-9 rounded-full bg-indigo-500 px-4 text-xs font-semibold hover:bg-indigo-400"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  Create issue
                </Button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

export default App;
