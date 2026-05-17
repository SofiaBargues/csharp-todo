# C# Todo

Aplicacion full stack con backend en ASP.NET Core y frontend en React/Vite.

## Hot reload

Abre dos terminales desde la raiz del repo.

Backend:

```powershell
dotnet watch --project .\Todo\Todo.Api\Todo.Api.csproj run --urls http://localhost:5000
```

Frontend:

```powershell
cd .\Todo\Todo.View
npm install
npm run dev
```

La app queda en `http://localhost:5173`.

El frontend usa el proxy de Vite para enviar `/api` a `http://localhost:5000`, asi que usa siempre la URL de Vite durante desarrollo. Swagger queda disponible en `http://localhost:5000/swagger`.

## VS Code

Tambien puedes ejecutar la tarea `Run full stack`. Esa tarea levanta:

- `dotnet watch` para el backend en `http://localhost:5000`
- `npm run dev` para el frontend con HMR

Para depurar, usa el compound `Debug full stack`.
