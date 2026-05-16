using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Todo.Domain.Entities;
using Todo.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:5174")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});
var connectionString = builder.Configuration.GetConnectionString("TodoDb")
    ?? "Data Source=todo.db";

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(connectionString));

var app = builder.Build();
var frontendDistPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "Todo.View", "dist"));

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    dbContext.Database.Migrate();

    if (!dbContext.TodoItems.Any())
    {
        dbContext.TodoItems.AddRange(
            new TodoItem { Title = "Create backend", IsCompleted = true },
            new TodoItem { Title = "Connect React with API" },
            new TodoItem { Title = "Replace InMemory with EF migrations" });
        dbContext.SaveChanges();
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (Directory.Exists(frontendDistPath))
{
    var frontendFiles = new PhysicalFileProvider(frontendDistPath);

    app.UseDefaultFiles(new DefaultFilesOptions
    {
        FileProvider = frontendFiles
    });

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = frontendFiles
    });
}

app.UseCors("frontend");

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/api/todos", async (AppDbContext dbContext) =>
    await dbContext.TodoItems
        .OrderBy(item => item.CreatedAtUtc)
        .ToListAsync());


app.MapPost("/api/todos", async (CreateTodoRequest request, AppDbContext dbContext) =>
{
    var title = request.Title?.Trim();
    var section = request.Section?.Trim();

    if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(section) || request.DueDate is null)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.Title)] = string.IsNullOrWhiteSpace(title)
                ? ["Title is required."]
                : [],
            [nameof(request.Section)] = string.IsNullOrWhiteSpace(section)
                ? ["Section is required."]
                : [],
            [nameof(request.DueDate)] = request.DueDate is null
                ? ["Due date is required."]
                : []
        }.Where(entry => entry.Value.Length > 0)
         .ToDictionary(entry => entry.Key, entry => entry.Value));
    }

    var todoItem = new TodoItem
    {
        Id = Guid.NewGuid(),
        Title = title,
        Section = section,
        DueDate = request.DueDate,
        IsCompleted = request.IsCompleted
    };

    dbContext.TodoItems.Add(todoItem);
    await dbContext.SaveChangesAsync();

    return Results.Created($"/api/todos/{todoItem.Id}", todoItem);
});

// PUT: Update a TodoItem
app.MapPut("/api/todos/{id:guid}", async (Guid id, UpdateTodoRequest request, AppDbContext dbContext) =>
{
    var todoItem = await dbContext.TodoItems.FindAsync(id);
    if (todoItem is null)
        return Results.NotFound();

    var title = request.Title?.Trim();
    var section = request.Section?.Trim();
    if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(section) || request.DueDate is null)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.Title)] = string.IsNullOrWhiteSpace(title)
                ? ["Title is required."]
                : [],
            [nameof(request.Section)] = string.IsNullOrWhiteSpace(section)
                ? ["Section is required."]
                : [],
            [nameof(request.DueDate)] = request.DueDate is null
                ? ["Due date is required."]
                : []
        }.Where(entry => entry.Value.Length > 0)
         .ToDictionary(entry => entry.Key, entry => entry.Value));
    }

    todoItem.Title = title;
    todoItem.Section = section;
    todoItem.DueDate = request.DueDate;
    todoItem.IsCompleted = request.IsCompleted;
    await dbContext.SaveChangesAsync();
    return Results.Ok(todoItem);
});

// PATCH: Update only the TodoItem status
app.MapPatch("/api/todos/{id:guid}/status", async (Guid id, UpdateTodoStatusRequest request, AppDbContext dbContext) =>
{
    var todoItem = await dbContext.TodoItems.FindAsync(id);
    if (todoItem is null)
        return Results.NotFound();

    todoItem.IsCompleted = request.IsCompleted;
    await dbContext.SaveChangesAsync();

    return Results.Ok(todoItem);
});

// DELETE: Delete a TodoItem
app.MapDelete("/api/todos/{id:guid}", async (Guid id, AppDbContext dbContext) =>
{
    var todoItem = await dbContext.TodoItems.FindAsync(id);
    if (todoItem is null)
        return Results.NotFound();

    dbContext.TodoItems.Remove(todoItem);
    await dbContext.SaveChangesAsync();
    return Results.NoContent();
});

if (Directory.Exists(frontendDistPath))
{
    app.MapFallback(async context =>
    {
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(Path.Combine(frontendDistPath, "index.html"));
    });
}

app.Run();

public sealed record CreateTodoRequest(string? Title, string? Section, DateOnly? DueDate, bool IsCompleted);
public sealed record UpdateTodoRequest(string? Title, string? Section, DateOnly? DueDate, bool IsCompleted);
public sealed record UpdateTodoStatusRequest(bool IsCompleted);
