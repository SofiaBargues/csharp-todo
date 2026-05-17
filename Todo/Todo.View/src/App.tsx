import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  CircleDashed,
  Layers3,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Tag,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type EditState = {
  id: string;
  title: string;
  section: string;
  dueDate: string;
  isCompleted: boolean;
  ownerId: string;
} | null;

type TodoItem = {
  id: string;
  title: string;
  isCompleted: boolean;
  section: string;
  dueDate: string | null;
  ownerId: string | null;
  createdAtUtc: string;
};

type Owner = {
  id: string;
  name: string;
  initials: string;
  createdAtUtc: string;
};

type ViewFilter = {
  id: string;
  label: string;
  kind: "all" | "active" | "section";
  value?: string;
};

type IssueStatus = {
  value: string;
  label: string;
  section: string;
  isCompleted: boolean;
  colorClass: string;
};

type NewIssueState = {
  isOpen: boolean;
  title: string;
  description: string;
  section: string;
  dueDate: string;
  ownerId: string;
  status: string;
};

const baseViews: ViewFilter[] = [
  { id: "all", label: "All issues", kind: "all" },
  { id: "active", label: "Active", kind: "active" },
  { id: "backlog", label: "Backlog", kind: "section", value: "Backlog" },
];

const customViewsKey = "todo.customViews";
const unassignedOwnerValue = "unassigned";
const issueStatuses: IssueStatus[] = [
  {
    value: "backlog",
    label: "Backlog",
    section: "Backlog",
    isCompleted: false,
    colorClass: "text-zinc-400",
  },
  {
    value: "todo",
    label: "Todo",
    section: "Todo",
    isCompleted: false,
    colorClass: "text-zinc-300",
  },
  {
    value: "in-progress",
    label: "In Progress",
    section: "In Progress",
    isCompleted: false,
    colorClass: "text-yellow-400",
  },
  {
    value: "in-review",
    label: "In Review",
    section: "In Review",
    isCompleted: false,
    colorClass: "text-emerald-400",
  },
  {
    value: "done",
    label: "Done",
    section: "Done",
    isCompleted: true,
    colorClass: "text-indigo-400",
  },
  {
    value: "canceled",
    label: "Canceled",
    section: "Canceled",
    isCompleted: true,
    colorClass: "text-zinc-500",
  },
  {
    value: "duplicate",
    label: "Duplicate",
    section: "Duplicate",
    isCompleted: true,
    colorClass: "text-zinc-500",
  },
];
const groupOrder = issueStatuses.map((status) => status.label);
const defaultIssueStatus = issueStatuses.find(
  (status) => status.value === "todo",
)!;

const emptyIssue: NewIssueState = {
  isOpen: false,
  title: "",
  description: "",
  section: defaultIssueStatus.section,
  dueDate: "",
  ownerId: "",
  status: defaultIssueStatus.value,
};

const formatDueDate = (dueDate: string | null) => {
  if (!dueDate) {
    return "No date";
  }

  const date = new Date(`${dueDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dueDate;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const toDateValue = (value: string) => {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

const toInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalize = (value: string) => value.trim().toLowerCase();

const getSectionLabel = (todo: TodoItem) => todo.section.trim() || "Todo";

const findStatusByValue = (value: string) =>
  issueStatuses.find((status) => status.value === value) ?? defaultIssueStatus;

const findStatusByLabel = (label: string) =>
  issueStatuses.find((status) => normalize(status.label) === normalize(label));

const getStatusFromTodo = (todo: TodoItem) => {
  const sectionStatus = findStatusByLabel(getSectionLabel(todo));

  if (sectionStatus) {
    return sectionStatus;
  }

  return todo.isCompleted
    ? findStatusByValue("done")
    : findStatusByValue("todo");
};

const getStatusFromDraft = (section: string, isCompleted: boolean) => {
  const sectionStatus = findStatusByLabel(section);

  if (sectionStatus) {
    return sectionStatus;
  }

  return isCompleted ? findStatusByValue("done") : findStatusByValue("todo");
};

const isActiveStatus = (status: IssueStatus) =>
  !["done", "canceled", "duplicate"].includes(status.value);

const getGroupLabel = (todo: TodoItem) =>
  getStatusFromTodo(todo).label;

const getDefaultSectionForView = (view: ViewFilter) => {
  if (view.kind === "section") {
    return view.value ?? view.label;
  }

  return "Todo";
};

const getStatusIcon = (status: IssueStatus, className?: string) => {
  const iconClassName = cn("size-4", status.colorClass, className);

  if (status.value === "done") {
    return <CheckCircle2 className={iconClassName} />;
  }

  if (status.value === "backlog") {
    return <CircleDashed className={iconClassName} />;
  }

  if (status.value === "in-progress") {
    return <CircleDashed className={iconClassName} />;
  }

  if (status.value === "canceled" || status.value === "duplicate") {
    return <X className={iconClassName} />;
  }

  return <Circle className={iconClassName} />;
};

const getGroupIcon = (label: string) =>
  getStatusIcon(findStatusByLabel(label) ?? defaultIssueStatus);

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

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

function DatePickerField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  disabled,
  className,
}: DatePickerFieldProps) {
  const selectedDate = toDateValue(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-8 justify-start rounded-full border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 hover:text-zinc-100",
            !selectedDate && "text-zinc-400",
            className,
          )}
          aria-label={ariaLabel}
          disabled={disabled}
        >
          <CalendarDays data-icon="inline-start" />
          {selectedDate ? formatDueDate(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto border-zinc-800 bg-[#1a1b1d] p-0 text-zinc-100"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => onChange(date ? toInputDate(date) : "")}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}

function App() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOwners, setIsLoadingOwners] = useState(true);
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
  const [isAddingOwner, setIsAddingOwner] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newIssue, setNewIssue] = useState<NewIssueState>(emptyIssue);
  const [selectedDueDate, setSelectedDueDate] = useState("");

  useEffect(() => {
    const loadOwners = async () => {
      try {
        setIsLoadingOwners(true);
        setError(null);

        const response = await fetch("/api/owners");

        if (!response.ok) {
          throw new Error("Could not load owners.");
        }

        const data = (await response.json()) as Owner[];
        setOwners(data);
        setSelectedOwnerId((currentOwnerId) => {
          if (currentOwnerId && data.some((owner) => owner.id === currentOwnerId)) {
            return currentOwnerId;
          }

          return data[0]?.id ?? "";
        });
      } catch {
        setError(
          "Could not connect to the API. Make sure the backend is running.",
        );
      } finally {
        setIsLoadingOwners(false);
      }
    };

    void loadOwners();
  }, []);

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
  const activeOwner = owners.find((owner) => owner.id === selectedOwnerId);
  const ownerById = useMemo(
    () => new Map(owners.map((owner) => [owner.id, owner])),
    [owners],
  );

  const filteredTodos = todos.filter((todo) => {
    if (selectedDueDate && todo.dueDate !== selectedDueDate) {
      return false;
    }

    if (activeView.kind === "active") {
      return isActiveStatus(getStatusFromTodo(todo));
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
    newIssue.title.trim() &&
      newIssue.section.trim() &&
      newIssue.dueDate,
  );
  const canEditIssue = Boolean(
    editState?.title.trim() && editState.section.trim() && editState.dueDate,
  );
  const newIssueOwner = newIssue.ownerId
    ? ownerById.get(newIssue.ownerId)
    : undefined;
  const editIssueOwner = editState?.ownerId
    ? ownerById.get(editState.ownerId)
    : undefined;

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

  const handleUpdateTodoStatus = async (todo: TodoItem, statusValue: string) => {
    const nextStatus = findStatusByValue(statusValue);

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: todo.title,
          section: nextStatus.section,
          dueDate: todo.dueDate,
          isCompleted: nextStatus.isCompleted,
          ownerId: todo.ownerId,
        }),
      });

      if (!response.ok) {
        throw new Error();
      }

      const updatedTodo = (await response.json()) as TodoItem;

      setTodos((currentTodos) =>
        currentTodos.map((currentTodo) =>
          currentTodo.id === updatedTodo.id ? updatedTodo : currentTodo,
        ),
      );
      setEditState((currentEditState) =>
        currentEditState?.id === updatedTodo.id
          ? {
              ...currentEditState,
              section: updatedTodo.section,
              isCompleted: updatedTodo.isCompleted,
            }
          : currentEditState,
      );
    } catch {
      setError("Could not update the task status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddOwner = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = newOwnerName.trim();

    if (!name) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch("/api/owners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      if (response.status === 409) {
        const data = (await response.json()) as { owner?: Owner };
        const existingOwner = data.owner;

        if (existingOwner) {
          setOwners((currentOwners) =>
            currentOwners.some((owner) => owner.id === existingOwner.id)
              ? currentOwners
              : [...currentOwners, existingOwner],
          );
          setSelectedOwnerId(existingOwner.id);
          setNewOwnerName("");
          setIsAddingOwner(false);
          return;
        }
      }

      if (!response.ok) {
        throw new Error("Could not save owner.");
      }

      const createdOwner = (await response.json()) as Owner;
      setOwners((currentOwners) => [...currentOwners, createdOwner]);
      setSelectedOwnerId(createdOwner.id);
      setNewOwnerName("");
      setIsAddingOwner(false);
    } catch {
      setError("Could not save the owner.");
    } finally {
      setIsSubmitting(false);
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
    setEditState(null);

    const groupStatus = groupLabel ? findStatusByLabel(groupLabel) : undefined;
    const defaultStatus =
      groupStatus ??
      findStatusByLabel(getDefaultSectionForView(activeView)) ??
      defaultIssueStatus;

    setNewIssue({
      isOpen: true,
      title: "",
      description: "",
      section: defaultStatus.section,
      dueDate: selectedDueDate,
      ownerId: selectedOwnerId,
      status: defaultStatus.value,
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
      setEditState((currentEditState) =>
        currentEditState?.id === id ? null : currentEditState,
      );
    } catch {
      setError("Could not delete the task.");
    }
  };

  const startEdit = (todo: TodoItem) => {
    setNewIssue(emptyIssue);
    setEditState({
      id: todo.id,
      title: todo.title,
      section: todo.section,
      dueDate: todo.dueDate ?? "",
      isCompleted: todo.isCompleted,
      ownerId: todo.ownerId ?? "",
    });
  };

  const cancelEdit = () => {
    setEditState(null);
  };

  const handleCreateIssue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextTitle = newIssue.title.trim();
    const nextStatus = findStatusByValue(newIssue.status);
    const nextSection = newIssue.section.trim() || nextStatus.section;

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
          isCompleted: nextStatus.isCompleted,
          ownerId: newIssue.ownerId || null,
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
          ownerId: editState.ownerId || null,
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
      <header className="border-b border-zinc-900 bg-[#101113]">
        <div className="mx-auto flex h-11 w-full max-w-6xl items-center gap-3 px-3 sm:px-5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-zinc-100 hover:bg-zinc-900 hover:text-zinc-100"
                disabled={isLoadingOwners}
              >
                <Avatar className="size-6 rounded-md">
                  <AvatarFallback className="rounded-md bg-emerald-500 text-[10px] font-black text-zinc-950">
                    {activeOwner?.initials ?? "..."}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-36 truncate">
                  {activeOwner?.name ?? "Loading"}
                </span>
                <ChevronDown data-icon="inline-end" className="text-zinc-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-72 border-zinc-800 bg-[#1a1b1d] text-zinc-100"
            >
              <DropdownMenuLabel className="text-xs uppercase text-zinc-500">
                Owners
              </DropdownMenuLabel>
              <ScrollArea className="max-h-64">
                <DropdownMenuGroup>
                  {owners.map((owner) => (
                    <DropdownMenuItem
                      key={owner.id}
                      className={cn(
                        "gap-2 focus:bg-zinc-800 focus:text-zinc-100",
                        owner.id === selectedOwnerId
                          ? "text-zinc-100"
                          : "text-zinc-400",
                      )}
                      onClick={() => setSelectedOwnerId(owner.id)}
                    >
                      <Avatar className="size-7 rounded-md">
                        <AvatarFallback className="rounded-md bg-zinc-800 text-[10px] font-black text-emerald-300">
                          {owner.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {owner.name}
                      </span>
                      {owner.id === selectedOwnerId ? (
                        <CheckCircle2 className="text-emerald-400" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </ScrollArea>

              <DropdownMenuSeparator className="bg-zinc-800" />
              <div className="p-1">
                {isAddingOwner ? (
                  <form className="flex items-center gap-2" onSubmit={handleAddOwner}>
                    <Input
                      className="h-8 border-zinc-700 bg-[#111113] text-sm text-zinc-100 placeholder:text-zinc-600"
                      value={newOwnerName}
                      onChange={(event) => setNewOwnerName(event.target.value)}
                      placeholder="Owner name"
                      autoFocus
                      disabled={isSubmitting}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="size-8 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                      disabled={isSubmitting || !newOwnerName.trim()}
                      aria-label="Save owner"
                    >
                      {isSubmitting ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <CheckCircle2 />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
                      onClick={() => {
                        setIsAddingOwner(false);
                        setNewOwnerName("");
                      }}
                      disabled={isSubmitting}
                      aria-label="Cancel owner"
                    >
                      <X />
                    </Button>
                  </form>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    onClick={() => setIsAddingOwner(true)}
                  >
                    <UserPlus data-icon="inline-start" />
                    Add owner
                  </Button>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <ChevronRight className="size-4 text-zinc-600" />
          <span className="text-sm font-semibold text-zinc-200">Issues</span>
          <ChevronRight className="size-4 text-zinc-600" />
          <span className="text-sm font-semibold text-zinc-200">Issues</span>
        </div>
      </header>

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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-full rounded-none px-3 text-inherit hover:bg-transparent hover:text-inherit"
                  onClick={() => setActiveViewId(view.id)}
                >
                  {view.label}
                </Button>
                {isCustomView ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-full w-7 rounded-none border-l border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
                    aria-label={`Remove ${view.label} view`}
                    onClick={() => handleRemoveView(view.id)}
                  >
                    <X />
                  </Button>
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
              <Input
                className="h-6 w-28 border-0 bg-transparent px-0 text-sm text-zinc-100 shadow-none placeholder:text-zinc-600 focus-visible:ring-0"
                value={newViewName}
                onChange={(event) => setNewViewName(event.target.value)}
                placeholder="New view"
                autoFocus
              />
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="size-6 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Save new view"
                disabled={!newViewName.trim()}
              >
                <CheckCircle2 />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Cancel new view"
                onClick={() => {
                  setIsAddingView(false);
                  setNewViewName("");
                }}
              >
                <X />
              </Button>
            </form>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full border-dashed border-zinc-800 bg-transparent text-zinc-500 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200"
              onClick={() => setIsAddingView(true)}
            >
              <Layers3 data-icon="inline-start" />
              New view
              <Pencil data-icon="inline-end" />
            </Button>
          )}

          <div className="ml-auto flex items-center gap-1">
            <DatePickerField
              value={selectedDueDate}
              onChange={setSelectedDueDate}
              placeholder="Due date"
              ariaLabel="Filter by due date"
              className="border-zinc-800 bg-[#111113] text-sm"
            />
            {selectedDueDate ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="Clear due date filter"
                onClick={() => setSelectedDueDate("")}
              >
                <X />
              </Button>
            ) : null}
          </div>
        </div>

        {error ? (
          <Alert className="mt-3 border-red-900/60 bg-red-950/40 text-red-200">
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading || isLoadingOwners ? (
          <Alert className="mt-3 border-zinc-800 bg-[#171719] text-zinc-400">
            <Loader2 className="animate-spin" />
            <AlertDescription>Loading workspace...</AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && !isLoadingOwners && !error ? (
          <div className="mt-3 flex flex-col gap-2">
            {filteredTodos.length === 0 ? (
              <Alert className="flex flex-col items-center gap-3 border-dashed border-zinc-800 bg-transparent p-8 text-center text-sm text-zinc-500">
                <span>No tasks in this view.</span>
                <Button
                  type="button"
                  className="h-8 rounded-full bg-indigo-500 px-4 text-xs font-semibold text-white hover:bg-indigo-400"
                  onClick={() => openNewIssueModal()}
                >
                  <Plus data-icon="inline-start" />
                  Add issue
                </Button>
              </Alert>
            ) : null}

            {groupedTodos.map(([groupLabel, groupTodos]) => {
              const isCollapsed = collapsedGroups.has(groupLabel);

              return (
                <section
                  key={groupLabel}
                  className="overflow-hidden rounded-md border border-zinc-900"
                >
                  <header className="flex h-9 items-center justify-between bg-[#171719] px-3 text-sm">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-w-0 justify-start px-0 font-semibold text-zinc-200 hover:bg-transparent hover:text-white"
                      aria-expanded={!isCollapsed}
                      aria-label={`Toggle ${groupLabel}`}
                      onClick={() => toggleGroup(groupLabel)}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="text-zinc-600" />
                      ) : (
                        <ChevronDown className="text-zinc-600" />
                      )}
                      {getGroupIcon(groupLabel)}
                      <span className="truncate">{groupLabel}</span>
                      <span className="font-normal text-zinc-500">
                        {groupTodos.length}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                      aria-label={`Add task to ${groupLabel}`}
                      onClick={() => openNewIssueModal(groupLabel)}
                    >
                      <Plus />
                    </Button>
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
                      const todoStatus = getStatusFromTodo(todo);
                      const owner = todo.ownerId
                        ? ownerById.get(todo.ownerId)
                        : undefined;

                      return (
                        <div
                          key={todo.id}
                          role="button"
                          tabIndex={0}
                          aria-disabled={isSubmitting}
                          className={cn(
                            "block w-full px-3 py-3 text-left hover:bg-zinc-900/55 focus-visible:bg-zinc-900/70 focus-visible:outline-none",
                            isSubmitting && "pointer-events-none opacity-60",
                          )}
                          onClick={() => {
                            if (!isSubmitting) {
                              startEdit(todo);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (
                              !isSubmitting &&
                              (event.key === "Enter" || event.key === " ")
                            ) {
                              event.preventDefault();
                              startEdit(todo);
                            }
                          }}
                        >
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-6 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
                                    aria-label={`Change status for ${todo.title}`}
                                    disabled={isSubmitting}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    {getStatusIcon(todoStatus)}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="start"
                                  className="w-60 border-zinc-800 bg-[#1a1b1d] text-zinc-100"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <DropdownMenuLabel className="text-xs uppercase text-zinc-500">
                                    Change status
                                  </DropdownMenuLabel>
                                  <DropdownMenuSeparator className="bg-zinc-800" />
                                  <DropdownMenuGroup>
                                    {issueStatuses.map((status, index) => (
                                      <DropdownMenuItem
                                        key={status.value}
                                        className="gap-3 focus:bg-zinc-800 focus:text-zinc-100"
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                        onSelect={() =>
                                          void handleUpdateTodoStatus(
                                            todo,
                                            status.value,
                                          )
                                        }
                                      >
                                        {getStatusIcon(status)}
                                        <span className="flex-1 font-medium">
                                          {status.label}
                                        </span>
                                        {todoStatus.value === status.value ? (
                                          <CheckCircle2 className="text-zinc-300" />
                                        ) : (
                                          <span className="text-xs text-zinc-500">
                                            {index + 1}
                                          </span>
                                        )}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuGroup>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <span className="font-medium text-zinc-500">
                                SB-{issueNumber}
                              </span>
                              <h2 className="min-w-0 break-words font-semibold text-zinc-100">
                                {todo.title}
                              </h2>
                              <Badge
                                variant="outline"
                                className="border-zinc-800 text-zinc-500"
                              >
                                {sectionLabel}
                              </Badge>
                            </div>
                            <div className="flex shrink-0 items-center justify-between gap-2 text-sm text-zinc-500 md:justify-end">
                              <Badge
                                variant="outline"
                                className="h-7 gap-2 rounded-full border-zinc-800 bg-[#111113] px-3 text-sm text-zinc-400"
                              >
                                <CalendarDays className="text-orange-500" />
                                {dueDateLabel}
                              </Badge>
                              <Avatar
                                className="size-7 border border-zinc-800 bg-[#111113]"
                                title={owner?.name ?? "Unassigned"}
                                aria-label={owner?.name ?? "Unassigned"}
                              >
                                <AvatarFallback className="bg-[#111113] text-[10px] font-black text-zinc-500">
                                  {owner?.initials ?? <UsersRound />}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          </div>
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

      <Dialog
        open={newIssue.isOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            closeNewIssueModal();
          }
        }}
      >
        <DialogContent className="top-8 max-w-3xl translate-y-0 overflow-hidden border-zinc-700 bg-[#1d1d1f] p-0 text-zinc-100 sm:top-8 sm:rounded-lg">
          <form
            className="flex min-h-[16rem] w-full flex-col"
            onSubmit={handleCreateIssue}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <Badge className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-emerald-300">
                  {newIssueOwner?.initials ?? <UsersRound className="inline size-3" />}
                </Badge>
                <ChevronRight className="size-4 text-zinc-500" />
                <DialogHeader className="gap-0">
                  <DialogTitle className="text-sm">New issue</DialogTitle>
                  <DialogDescription className="sr-only">
                    Create a new todo issue.
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-4 px-5 py-5">
              <Input
                className="h-auto border-0 bg-transparent px-0 py-0 text-xl font-semibold text-zinc-100 shadow-none placeholder:text-zinc-500 focus-visible:ring-0"
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
              <Textarea
                className="min-h-20 resize-none border-0 bg-transparent px-0 py-0 text-sm text-zinc-200 shadow-none placeholder:text-zinc-600 focus-visible:ring-0"
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
                  value={newIssue.status}
                  onValueChange={(value) =>
                    setNewIssue((currentIssue) => {
                      const nextStatus = findStatusByValue(value);

                      return {
                        ...currentIssue,
                        section: nextStatus.section,
                        status: nextStatus.value,
                      };
                    })
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    aria-label="Issue status"
                    className="h-8 w-auto rounded-full border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-100"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-[#1a1b1d] text-zinc-100">
                    <SelectGroup>
                      {issueStatuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          <span className="flex items-center gap-2">
                            {getStatusIcon(status)}
                            {status.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
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
                <DatePickerField
                  value={newIssue.dueDate}
                  onChange={(value) =>
                    setNewIssue((currentIssue) => ({
                      ...currentIssue,
                      dueDate: value,
                    }))
                  }
                  placeholder="Due date"
                  ariaLabel="Issue due date"
                  disabled={isSubmitting}
                />
                <Select
                  value={newIssue.ownerId || unassignedOwnerValue}
                  onValueChange={(value) =>
                    setNewIssue((currentIssue) => ({
                      ...currentIssue,
                      ownerId: value === unassignedOwnerValue ? "" : value,
                    }))
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    aria-label="Issue owner"
                    className="h-8 w-36 rounded-full border-zinc-700 bg-zinc-800 py-1 pl-3 pr-3 text-xs font-semibold text-zinc-100"
                  >
                    <UsersRound data-icon="inline-start" className="text-zinc-400" />
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-[#1a1b1d] text-zinc-100">
                    <SelectGroup>
                      <SelectItem value={unassignedOwnerValue}>
                        Unassigned
                      </SelectItem>
                      {owners.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-zinc-700 bg-zinc-800 text-xs font-semibold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                >
                  <Tag data-icon="inline-start" />
                  Labels
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-full border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                  aria-label="More issue options"
                >
                  <MoreHorizontal />
                </Button>
              </div>
            </div>

            <Separator className="bg-zinc-800" />
            <DialogFooter className="flex-row items-center justify-between px-5 py-3 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                aria-label="Attach file"
              >
                <Paperclip />
              </Button>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  <Checkbox disabled />
                  Create more
                </label>
                <Button
                  type="submit"
                  disabled={isSubmitting || !canCreateIssue}
                  className="h-9 rounded-full bg-indigo-500 px-4 text-xs font-semibold hover:bg-indigo-400"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                  Create issue
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editState)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            cancelEdit();
          }
        }}
      >
        <DialogContent className="top-8 max-w-3xl translate-y-0 overflow-hidden border-zinc-700 bg-[#1d1d1f] p-0 text-zinc-100 sm:top-8 sm:rounded-lg">
          {editState ? (
          <form
            className="flex min-h-[16rem] w-full flex-col"
            onSubmit={handleEditSubmit}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <Badge className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-emerald-300">
                  {editIssueOwner?.initials ?? <UsersRound className="inline size-3" />}
                </Badge>
                <ChevronRight className="size-4 text-zinc-500" />
                <DialogHeader className="gap-0">
                  <DialogTitle className="text-sm">Edit issue</DialogTitle>
                  <DialogDescription className="sr-only">
                    Update or delete this todo issue.
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-4 px-5 py-5">
              <Input
                className="h-auto border-0 bg-transparent px-0 py-0 text-xl font-semibold text-zinc-100 shadow-none placeholder:text-zinc-500 focus-visible:ring-0"
                value={editState.title}
                onChange={(event) =>
                  setEditState({
                    ...editState,
                    title: event.target.value,
                  })
                }
                placeholder="Issue title"
                autoFocus
                disabled={isSubmitting}
              />
              <Textarea
                className="min-h-20 resize-none border-0 bg-transparent px-0 py-0 text-sm text-zinc-200 shadow-none placeholder:text-zinc-600 focus-visible:ring-0"
                defaultValue=""
                placeholder="Add description..."
                disabled
              />
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={
                    getStatusFromDraft(
                      editState.section,
                      editState.isCompleted,
                    ).value
                  }
                  onValueChange={(value) => {
                    const nextStatus = findStatusByValue(value);

                    setEditState({
                      ...editState,
                      section: nextStatus.section,
                      isCompleted: nextStatus.isCompleted,
                    });
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    aria-label="Issue status"
                    className="h-8 w-auto rounded-full border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-100"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-[#1a1b1d] text-zinc-100">
                    <SelectGroup>
                      {issueStatuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          <span className="flex items-center gap-2">
                            {getStatusIcon(status)}
                            {status.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 w-36 rounded-full border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-100 placeholder:text-zinc-500"
                  value={editState.section}
                  onChange={(event) =>
                    setEditState({
                      ...editState,
                      section: event.target.value,
                    })
                  }
                  placeholder="Section"
                  disabled={isSubmitting}
                />
                <DatePickerField
                  value={editState.dueDate}
                  onChange={(value) =>
                    setEditState({
                      ...editState,
                      dueDate: value,
                    })
                  }
                  placeholder="Due date"
                  ariaLabel="Issue due date"
                  disabled={isSubmitting}
                />
                <Select
                  value={editState.ownerId || unassignedOwnerValue}
                  onValueChange={(value) =>
                    setEditState({
                      ...editState,
                      ownerId: value === unassignedOwnerValue ? "" : value,
                    })
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    aria-label="Issue owner"
                    className="h-8 w-36 rounded-full border-zinc-700 bg-zinc-800 py-1 pl-3 pr-3 text-xs font-semibold text-zinc-100"
                  >
                    <UsersRound data-icon="inline-start" className="text-zinc-400" />
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-[#1a1b1d] text-zinc-100">
                    <SelectGroup>
                      <SelectItem value={unassignedOwnerValue}>
                        Unassigned
                      </SelectItem>
                      {owners.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-zinc-700 bg-zinc-800 text-xs font-semibold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                >
                  <Tag data-icon="inline-start" />
                  Labels
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-full border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                  aria-label="More issue options"
                >
                  <MoreHorizontal />
                </Button>
              </div>
            </div>

            <Separator className="bg-zinc-800" />
            <DialogFooter className="flex-row items-center justify-between px-5 py-3 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                aria-label="Attach file"
              >
                <Paperclip />
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-full px-4 text-xs font-semibold text-red-300 hover:bg-red-950/40 hover:text-red-200"
                  onClick={() => handleDelete(editState.id)}
                  disabled={isSubmitting}
                >
                  Delete
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-full px-4 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                  onClick={cancelEdit}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !canEditIssue}
                  className="h-9 rounded-full bg-indigo-500 px-4 text-xs font-semibold hover:bg-indigo-400"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                  Save changes
                </Button>
              </div>
            </DialogFooter>
          </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default App;
