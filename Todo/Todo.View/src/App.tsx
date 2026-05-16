import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import "./App.css";

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

  return (
    <main className="app-shell">
      <section className="workspace-panel">
        <form className="todo-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="todo-title">
            Nueva tarea
          </label>
          <div className="form-grid">
            <input
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
            <input
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
            <label className="checkbox-row" htmlFor="todo-starred">
              Marcar como destacada
            </label>
            <div className="form-row">
              <button type="submit" disabled={isSubmitting || !canSubmit}>
                {isSubmitting ? "Guardando..." : "Agregar"}
              </button>
            </div>
          </div>
        </form>

        {error ? <p className="feedback error">{error}</p> : null}
        {isLoading ? <p className="feedback">Cargando tareas...</p> : null}

        {!isLoading && !error ? (
          <ul className="todo-list">
            {todos.map((todo: TodoItem) => (
              <li key={todo.id} className="todo-card">
                {editState && editState.id === todo.id ? (
                  <form className="edit-form" onSubmit={handleEditSubmit}>
                    <input
                      type="text"
                      value={editState.title}
                      onChange={(e) =>
                        setEditState({ ...editState, title: e.target.value })
                      }
                      disabled={isSubmitting}
                    />
                    <input
                      type="text"
                      value={editState.section}
                      onChange={(e) =>
                        setEditState({ ...editState, section: e.target.value })
                      }
                      disabled={isSubmitting}
                    />
                    <button
                      type="submit"
                      disabled={
                        isSubmitting ||
                        !editState.title.trim() ||
                        !editState.section.trim()
                      }
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={isSubmitting}
                    >
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <>
                    <div>
                      {(() => {
                        const sectionLabel =
                          todo.section.trim() || "Sin seccion";
                        return (
                          <>
                            <div className="todo-heading">
                              <p className="todo-title">{todo.title}</p>
                            </div>
                            <p className="todo-meta">
                              Seccion {sectionLabel} · Creada{" "}
                              {new Date(todo.createdAtUtc).toLocaleString(
                                "es-AR",
                              )}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                    <span
                      className={
                        todo.isCompleted
                          ? "todo-status done"
                          : "todo-status pending"
                      }
                    >
                      {todo.isCompleted ? "Hecha" : "Pendiente"}
                    </span>
                    <div className="todo-actions">
                      <button
                        onClick={() => startEdit(todo)}
                        disabled={isSubmitting}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(todo.id)}
                        disabled={isSubmitting}
                      >
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}

export default App;
