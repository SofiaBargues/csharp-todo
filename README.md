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

## Auth0

La app usa Auth0 con Google como proveedor de login. En Auth0 crea:

- Una aplicacion `Single Page Application` para React.
- Una API con audience, por ejemplo `https://todo-api`.
- Google como social connection habilitada para esa aplicacion.

Configura el backend en `Todo/Todo.Api/appsettings.json` o con variables de entorno:

```json
"Auth0": {
  "Domain": "your-tenant.us.auth0.com",
  "Audience": "https://todo-api"
}
```

Configura el frontend creando `Todo/Todo.View/.env.local` desde `Todo/Todo.View/.env.example`:

```text
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-auth0-spa-client-id
VITE_AUTH0_AUDIENCE=https://todo-api
```

En Auth0 agrega `http://localhost:5173` como Allowed Callback URL, Allowed Logout URL y Allowed Web Origin.

## VS Code

Tambien puedes ejecutar la tarea `Run full stack`. Esa tarea levanta:

- `dotnet watch` para el backend en `http://localhost:5000`
- `npm run dev` para el frontend con HMR

Para depurar, usa el compound `Debug full stack`.
