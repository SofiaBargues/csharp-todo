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

    var defaultOwner = dbContext.Owners.FirstOrDefault();

    if (defaultOwner is null)
    {
        defaultOwner = new Owner
        {
            Id = Guid.NewGuid(),
            Name = "Sofia",
            Initials = "SOF"
        };

        dbContext.Owners.Add(defaultOwner);
        dbContext.SaveChanges();
    }

    if (!dbContext.TodoItems.Any())
    {
        dbContext.TodoItems.AddRange(
            new TodoItem { Title = "Create backend", IsCompleted = true, Section = "Done", OwnerId = defaultOwner.Id },
            new TodoItem { Title = "Connect React with API", Section = "Todo", OwnerId = defaultOwner.Id },
            new TodoItem { Title = "Replace InMemory with EF migrations", Section = "Backlog", OwnerId = defaultOwner.Id });
        dbContext.SaveChanges();
    }
    else if (dbContext.TodoItems.Any(item => item.OwnerId == null))
    {
        await dbContext.TodoItems
            .Where(item => item.OwnerId == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.OwnerId, defaultOwner.Id));
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

app.MapGet("/api/owners", async (AppDbContext dbContext) =>
    await dbContext.Owners
        .OrderBy(item => item.CreatedAtUtc)
        .Select(owner => new OwnerResponse(owner.Id, owner.Name, owner.Initials, owner.CreatedAtUtc))
        .ToListAsync());

app.MapPost("/api/owners", async (CreateOwnerRequest request, AppDbContext dbContext) =>
{
    var name = request.Name?.Trim();

    if (string.IsNullOrWhiteSpace(name))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.Name)] = ["Owner name is required."]
        });
    }

    var existingOwner = await dbContext.Owners
        .FirstOrDefaultAsync(owner => owner.Name.ToLower() == name.ToLower());

    if (existingOwner is not null)
    {
        return Results.Conflict(new
        {
            message = "Owner already exists.",
            owner = new OwnerResponse(existingOwner.Id, existingOwner.Name, existingOwner.Initials, existingOwner.CreatedAtUtc)
        });
    }

    var owner = new Owner
    {
        Id = Guid.NewGuid(),
        Name = name,
        Initials = CreateInitials(name)
    };

    dbContext.Owners.Add(owner);
    dbContext.TodoItems.Add(new TodoItem
    {
        Id = Guid.NewGuid(),
        Title = $"Set up {name}'s first issue",
        Section = "Todo",
        DueDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
        OwnerId = owner.Id
    });

    await dbContext.SaveChangesAsync();

    return Results.Created(
        $"/api/owners/{owner.Id}",
        new OwnerResponse(owner.Id, owner.Name, owner.Initials, owner.CreatedAtUtc));
});

app.MapGet("/api/todos", async (Guid? ownerId, AppDbContext dbContext) =>
{
    var query = dbContext.TodoItems.AsQueryable();

    if (ownerId is not null)
    {
        query = query.Where(item => item.OwnerId == ownerId);
    }

    return await query
        .OrderBy(item => item.CreatedAtUtc)
        .ToListAsync();
});

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
                : [],
        }.Where(entry => entry.Value.Length > 0)
         .ToDictionary(entry => entry.Key, entry => entry.Value));
    }

    if (request.OwnerId is not null &&
        !await dbContext.Owners.AnyAsync(owner => owner.Id == request.OwnerId))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.OwnerId)] = ["Owner does not exist."]
        });
    }

    var todoItem = new TodoItem
    {
        Id = Guid.NewGuid(),
        Title = title,
        Section = section,
        DueDate = request.DueDate,
        OwnerId = request.OwnerId,
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

    if (request.OwnerId is not null &&
        !await dbContext.Owners.AnyAsync(owner => owner.Id == request.OwnerId))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.OwnerId)] = ["Owner does not exist."]
        });
    }

    todoItem.Title = title;
    todoItem.Section = section;
    todoItem.DueDate = request.DueDate;
    todoItem.IsCompleted = request.IsCompleted;
    todoItem.OwnerId = request.OwnerId;
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

static string CreateInitials(string name)
{
    var initials = string.Concat(name
        .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Take(2)
        .Select(part => part[0])).ToUpperInvariant();

    return initials.Length > 0 ? initials[..Math.Min(initials.Length, 4)] : "OWN";
}

public sealed record CreateOwnerRequest(string? Name);
public sealed record OwnerResponse(Guid Id, string Name, string Initials, DateTime CreatedAtUtc);
public sealed record CreateTodoRequest(string? Title, string? Section, DateOnly? DueDate, bool IsCompleted, Guid? OwnerId);
public sealed record UpdateTodoRequest(string? Title, string? Section, DateOnly? DueDate, bool IsCompleted, Guid? OwnerId);
public sealed record UpdateTodoStatusRequest(bool IsCompleted);
