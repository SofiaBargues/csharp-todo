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
    var todoItem = new TodoItem
    {
        Id = Guid.NewGuid(),
        Title = request.Title.Trim()
    };

    dbContext.TodoItems.Add(todoItem);
    await dbContext.SaveChangesAsync();

    return Results.Created($"/api/todos/{todoItem.Id}", todoItem);
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

public sealed record CreateTodoRequest(string Title);