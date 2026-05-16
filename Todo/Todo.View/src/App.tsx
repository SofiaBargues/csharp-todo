import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type EditState = {
  id: string;
  title: string;
  section: string;
} | null;

type TodoItem = {
  id: string;
  title: string;
  isCompleted: boolean;
  section: string;
  createdAtUtc: string;
};

function App() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [title, setTitle] = useState("");
  const [section, setSection] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(null);

  useEffect(() => {
    const loadTodos = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/todos");

        if (!response.ok) {
          throw new Error("No se pudieron cargar las tareas.");
        }

        const data = (await response.json()) as TodoItem[];
        setTodos(data);
      } catch {
        setError(
          "No se pudo conectar con la API. Verifica que el backend este corriendo.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadTodos();
  }, []);

  const pendingCount = todos.filter(
    (todo: TodoItem) => !todo.isCompleted,
  ).length;
  const canSubmit = Boolean(title.trim() && section.trim());

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Seguro que quieres eliminar esta tarea?")) {
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
      setError("No se pudo eliminar la tarea.");
    }
  };

  const startEdit = (todo: TodoItem) => {
    setEditState({ id: todo.id, title: todo.title, section: todo.section });
  };

  const cancelEdit = () => {
    setEditState(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextTitle = title.trim();
    const nextSection = section.trim();

    if (!nextTitle || !nextSection) {
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
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo guardar la tarea.");
      }

      const createdTodo = (await response.json()) as TodoItem;

      setTodos((currentTodos: TodoItem[]) => [...currentTodos, createdTodo]);
      setTitle("");
      setSection("");
    } catch {
      setError(
        "No se pudo guardar la tarea. Revisa que la API siga disponible.",
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

    if (!nextTitle || !nextSection) {
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
      setError("No se pudo actualizar la tarea.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit">
              Todo.Api conectado
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
                Tareas
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Organiza secciones, edita pendientes y manten la lista clara.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-64">
            <Card className="rounded-md">
              <CardContent className="flex items-center gap-3 p-4">
                <ClipboardList className="size-5 text-primary" />
                <div>
                  <p className="text-2xl font-semibold">{todos.length}</p>
                  <p className="text-xs text-muted-foreground">Totales</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-md">
              <CardContent className="flex items-center gap-3 p-4">
                <CheckCircle2 className="size-5 text-emerald-600" />
                <div>
                  <p className="text-2xl font-semibold">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Nueva tarea</CardTitle>
            <CardDescription>
              Agrega un titulo y una seccion para guardarla en la API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"
              onSubmit={handleSubmit}
            >
              <Input
                id="todo-title"
                name="title"
                type="text"
                placeholder="Ej. Conectar Todo.View con Todo.Api"
                value={title}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setTitle(event.target.value)
                }
                disabled={isSubmitting}
              />
              <Input
                id="todo-section"
                name="section"
                type="text"
                placeholder="Ej. Trabajo, Personal, Urgente"
                value={section}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setSection(event.target.value)
                }
                disabled={isSubmitting}
              />
              <Button
                className="w-full md:w-auto"
                type="submit"
                disabled={isSubmitting || !canSubmit}
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Plus />
                )}
                {isSubmitting ? "Guardando" : "Agregar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error ? (
          <Card className="rounded-md border-destructive/30 bg-red-50 text-destructive">
            <CardContent className="p-4 text-sm font-medium">
              {error}
            </CardContent>
          </Card>
        ) : null}

        {isLoading ? (
          <Card className="rounded-md">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando tareas...
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && !error ? (
          <div className="grid gap-3">
            {todos.length === 0 ? (
              <Card className="rounded-md border-dashed">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Todavia no hay tareas.
                </CardContent>
              </Card>
            ) : null}

            {todos.map((todo: TodoItem) => {
              const sectionLabel = todo.section.trim() || "Sin seccion";
              const createdAt = new Date(todo.createdAtUtc).toLocaleString(
                "es-AR",
              );

              return (
                <Card key={todo.id} className="rounded-md">
                  <CardContent className="p-4">
                    {editState && editState.id === todo.id ? (
                      <form
                        className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]"
                        onSubmit={handleEditSubmit}
                      >
                        <Input
                          type="text"
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
                          value={editState.section}
                          onChange={(event) =>
                            setEditState({
                              ...editState,
                              section: event.target.value,
                            })
                          }
                          disabled={isSubmitting}
                        />
                        <Button
                          type="submit"
                          disabled={
                            isSubmitting ||
                            !editState.title.trim() ||
                            !editState.section.trim()
                          }
                        >
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={cancelEdit}
                          disabled={isSubmitting}
                        >
                          <X />
                          Cancelar
                        </Button>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="break-words text-base font-semibold">
                              {todo.title}
                            </h2>
                            <Badge
                              variant={todo.isCompleted ? "success" : "warning"}
                            >
                              {todo.isCompleted ? "Hecha" : "Pendiente"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            <span>{sectionLabel}</span>
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="size-4" />
                              {createdAt}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Editar tarea"
                            onClick={() => startEdit(todo)}
                            disabled={isSubmitting}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Eliminar tarea"
                            onClick={() => handleDelete(todo.id)}
                            disabled={isSubmitting}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default App;
