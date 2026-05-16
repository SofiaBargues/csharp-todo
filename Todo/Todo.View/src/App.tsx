import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import "./App.css";

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
      <section className="hero-panel">
        <p className="eyebrow">Todo dashboard</p>
        <h1>Tu lista vive en la API y se actualiza desde React.</h1>
        <p className="hero-copy">
          Este frontend consume <strong>/api/todos</strong> y crea nuevas tareas
          contra el backend en tiempo real.
        </p>

        <div className="stats-grid">
          <article>
            <span>Total</span>
            <strong>{todos.length}</strong>
          </article>
          <article>
            <span>Pendientes</span>
            <strong>{pendingCount}</strong>
          </article>
          <article>
            <span>Completadas</span>
            <strong>{todos.length - pendingCount}</strong>
          </article>
        </div>
      </section>

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
                <div>
                  {(() => {
                    const sectionLabel = todo.section.trim() || "Sin seccion";

                    return (
                      <>
                        <div className="todo-heading">
                          <p className="todo-title">{todo.title}</p>
                        </div>
                        <p className="todo-meta">
                          Seccion {sectionLabel} · Creada{" "}
                          {new Date(todo.createdAtUtc).toLocaleString("es-AR")}
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
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}

export default App;
