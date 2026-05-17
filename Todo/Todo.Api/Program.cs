using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Todo.Domain.Entities;
using Todo.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var domain = builder.Configuration["Auth0:Domain"] ?? "auth0.example.invalid";
        var audience = builder.Configuration["Auth0:Audience"] ?? "missing-auth0-audience";

        options.Authority = $"https://{domain.TrimEnd('/')}/";
        options.Audience = audience;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            NameClaimType = "name"
        };
    });
builder.Services.AddAuthorization();
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
    await SeedDataAsync(dbContext);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (Directory.Exists(frontendDistPath))
{
    var frontendFiles = new PhysicalFileProvider(frontendDistPath);

    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = frontendFiles });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = frontendFiles });
}

app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }))
    .AllowAnonymous();

var api = app.MapGroup("/api")
    .RequireAuthorization();

api.MapGet("/me", async (ClaimsPrincipal principal, AppDbContext dbContext) =>
{
    var user = await UpsertCurrentUserAsync(principal, dbContext, null);

    return user.IsActive
        ? Results.Ok(ToUserResponse(user))
        : Results.Forbid();
});

api.MapPost("/me", async (SyncCurrentUserRequest request, ClaimsPrincipal principal, AppDbContext dbContext) =>
{
    var user = await UpsertCurrentUserAsync(principal, dbContext, request);

    return user.IsActive
        ? Results.Ok(ToUserResponse(user))
        : Results.Forbid();
});

api.MapGet("/owners", async (AppDbContext dbContext) =>
    await dbContext.Owners
        .OrderBy(owner => owner.Name)
        .Select(owner => new OwnerResponse(owner.Id, owner.Name, owner.Initials, owner.CreatedAtUtc))
        .ToListAsync());

api.MapPost("/owners", async (CreateOwnerRequest request, AppDbContext dbContext) =>
{
    var name = request.Name?.Trim();

    if (string.IsNullOrWhiteSpace(name))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.Name)] = ["Assignee name is required."]
        });
    }

    var existingOwner = await dbContext.Owners
        .FirstOrDefaultAsync(owner => owner.Name.ToLower() == name.ToLower());

    if (existingOwner is not null)
    {
        return Results.Conflict(new
        {
            message = "Assignee already exists.",
            owner = ToOwnerResponse(existingOwner)
        });
    }

    var owner = new Owner
    {
        Id = Guid.NewGuid(),
        Name = name,
        Initials = CreateInitials(name)
    };

    dbContext.Owners.Add(owner);
    await dbContext.SaveChangesAsync();

    return Results.Created($"/api/owners/{owner.Id}", ToOwnerResponse(owner));
});

api.MapGet("/projects", async (AppDbContext dbContext) =>
{
    var projects = await dbContext.Projects
        .Include(project => project.TodoItems)
        .OrderBy(project => project.CreatedAtUtc)
        .ToListAsync();

    return projects.Select(ToProjectResponse).ToList();
});

api.MapGet("/projects/{id:guid}", async (Guid id, AppDbContext dbContext) =>
{
    var project = await dbContext.Projects
        .Include(project => project.TodoItems)
            .ThenInclude(issue => issue.Owner)
        .FirstOrDefaultAsync(project => project.Id == id);

    return project is null
        ? Results.NotFound()
        : Results.Ok(ToProjectDetailResponse(project));
});

api.MapPost("/projects", async (CreateProjectRequest request, AppDbContext dbContext) =>
{
    var name = request.Name?.Trim();

    if (string.IsNullOrWhiteSpace(name))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.Name)] = ["Project name is required."]
        });
    }

    var project = new Project
    {
        Id = Guid.NewGuid(),
        Name = name,
        Description = request.Description?.Trim() ?? string.Empty
    };

    dbContext.Projects.Add(project);
    await dbContext.SaveChangesAsync();

    return Results.Created($"/api/projects/{project.Id}", ToProjectResponse(project));
});

api.MapPut("/projects/{id:guid}", async (Guid id, UpdateProjectRequest request, AppDbContext dbContext) =>
{
    var project = await dbContext.Projects.FindAsync(id);

    if (project is null)
    {
        return Results.NotFound();
    }

    var name = request.Name?.Trim();

    if (string.IsNullOrWhiteSpace(name))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.Name)] = ["Project name is required."]
        });
    }

    project.Name = name;
    project.Description = request.Description?.Trim() ?? string.Empty;
    await dbContext.SaveChangesAsync();

    return Results.Ok(ToProjectResponse(project));
});

api.MapGet("/issues", async (Guid? projectId, AppDbContext dbContext) =>
{
    var query = dbContext.TodoItems
        .Include(issue => issue.Owner)
        .Include(issue => issue.Project)
        .AsQueryable();

    if (projectId is not null)
    {
        query = query.Where(issue => issue.ProjectId == projectId);
    }

    var issues = await query
        .OrderBy(issue => issue.IssueNumber)
        .ToListAsync();

    return issues.Select(ToIssueResponse).ToList();
});

api.MapGet("/issues/{id:guid}", async (Guid id, AppDbContext dbContext) =>
{
    var issue = await dbContext.TodoItems
        .Include(issue => issue.Owner)
        .Include(issue => issue.Project)
        .FirstOrDefaultAsync(issue => issue.Id == id);

    return issue is null
        ? Results.NotFound()
        : Results.Ok(ToIssueResponse(issue));
});

api.MapPost("/issues", async (CreateIssueRequest request, AppDbContext dbContext) =>
{
    var validation = await ValidateIssueRequestAsync(request.Title, request.Status, request.ProjectId, request.OwnerId, dbContext);

    if (validation is not null)
    {
        return validation;
    }

    var status = NormalizeStatus(request.Status);
    var nextIssueNumber = await GetNextIssueNumberAsync(dbContext);
    var issue = new TodoItem
    {
        Id = Guid.NewGuid(),
        IssueNumber = nextIssueNumber,
        Title = request.Title!.Trim(),
        Description = request.Description?.Trim() ?? string.Empty,
        Status = status,
        IsCompleted = IsCompletedStatus(status),
        ProjectId = request.ProjectId,
        OwnerId = request.OwnerId
    };

    dbContext.TodoItems.Add(issue);
    await dbContext.SaveChangesAsync();

    var createdIssue = await LoadIssueAsync(issue.Id, dbContext);

    return Results.Created($"/api/issues/{issue.Id}", ToIssueResponse(createdIssue!));
});

api.MapPut("/issues/{id:guid}", async (Guid id, UpdateIssueRequest request, AppDbContext dbContext) =>
{
    var issue = await dbContext.TodoItems.FindAsync(id);

    if (issue is null)
    {
        return Results.NotFound();
    }

    var validation = await ValidateIssueRequestAsync(request.Title, request.Status, request.ProjectId, request.OwnerId, dbContext);

    if (validation is not null)
    {
        return validation;
    }

    var status = NormalizeStatus(request.Status);
    issue.Title = request.Title!.Trim();
    issue.Description = request.Description?.Trim() ?? string.Empty;
    issue.Status = status;
    issue.IsCompleted = IsCompletedStatus(status);
    issue.ProjectId = request.ProjectId;
    issue.OwnerId = request.OwnerId;

    await dbContext.SaveChangesAsync();

    var updatedIssue = await LoadIssueAsync(issue.Id, dbContext);

    return Results.Ok(ToIssueResponse(updatedIssue!));
});

api.MapPatch("/issues/{id:guid}/status", async (Guid id, UpdateIssueStatusRequest request, AppDbContext dbContext) =>
{
    var issue = await dbContext.TodoItems.FindAsync(id);

    if (issue is null)
    {
        return Results.NotFound();
    }

    var status = NormalizeStatus(request.Status);

    if (!IssueStatusCatalog.All.Contains(status))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.Status)] = ["Status does not exist."]
        });
    }

    issue.Status = status;
    issue.IsCompleted = IsCompletedStatus(status);
    await dbContext.SaveChangesAsync();

    var updatedIssue = await LoadIssueAsync(issue.Id, dbContext);

    return Results.Ok(ToIssueResponse(updatedIssue!));
});

api.MapDelete("/issues/{id:guid}", async (Guid id, AppDbContext dbContext) =>
{
    var issue = await dbContext.TodoItems.FindAsync(id);

    if (issue is null)
    {
        return Results.NotFound();
    }

    dbContext.TodoItems.Remove(issue);
    await dbContext.SaveChangesAsync();

    return Results.NoContent();
});

// Backwards-compatible aliases while the app finishes moving away from "todos".
api.MapGet("/todos", async (AppDbContext dbContext) =>
{
    var issues = await dbContext.TodoItems
        .Include(issue => issue.Owner)
        .Include(issue => issue.Project)
        .OrderBy(issue => issue.IssueNumber)
        .ToListAsync();

    return issues.Select(ToIssueResponse).ToList();
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

static async Task SeedDataAsync(AppDbContext dbContext)
{
    var defaultOwner = await dbContext.Owners.FirstOrDefaultAsync();

    if (defaultOwner is null)
    {
        defaultOwner = new Owner
        {
            Id = Guid.NewGuid(),
            Name = "Sofia Bargues",
            Initials = "SOF"
        };

        dbContext.Owners.Add(defaultOwner);
        await dbContext.SaveChangesAsync();
    }

    var defaultProject = await dbContext.Projects.FirstOrDefaultAsync();

    if (defaultProject is null)
    {
        defaultProject = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Alpha",
            Description = "Default product workspace."
        };

        dbContext.Projects.Add(defaultProject);
        await dbContext.SaveChangesAsync();
    }

    if (!await dbContext.TodoItems.AnyAsync())
    {
        dbContext.TodoItems.AddRange(
            new TodoItem
            {
                Id = Guid.NewGuid(),
                IssueNumber = 1,
                Title = "Set up the first project",
                Description = "Create the first workspace project and keep the issue list grouped by status.",
                Status = "In Progress",
                ProjectId = defaultProject.Id,
                OwnerId = defaultOwner.Id
            },
            new TodoItem
            {
                Id = Guid.NewGuid(),
                IssueNumber = 2,
                Title = "Create an editable issue page",
                Description = "Open an issue on its own route so the URL can be shared.",
                Status = "Todo",
                ProjectId = defaultProject.Id,
                OwnerId = defaultOwner.Id
            });

        await dbContext.SaveChangesAsync();
    }
}

static async Task<User> UpsertCurrentUserAsync(
    ClaimsPrincipal principal,
    AppDbContext dbContext,
    SyncCurrentUserRequest? profile)
{
    var auth0Subject = principal.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? principal.FindFirstValue("sub");

    if (string.IsNullOrWhiteSpace(auth0Subject))
    {
        throw new InvalidOperationException("Authenticated request is missing the subject claim.");
    }

    var emailClaim = profile?.Email?.Trim();
    emailClaim = string.IsNullOrWhiteSpace(emailClaim)
        ? principal.FindFirstValue(ClaimTypes.Email)
            ?? principal.FindFirstValue("email")
        : emailClaim;
    var nameClaim = profile?.Name?.Trim();
    nameClaim = string.IsNullOrWhiteSpace(nameClaim)
        ? principal.FindFirstValue("name")
            ?? principal.FindFirstValue("nickname")
        : nameClaim;
    var avatarClaim = profile?.AvatarUrl?.Trim();
    avatarClaim = string.IsNullOrWhiteSpace(avatarClaim)
        ? principal.FindFirstValue("picture")
        : avatarClaim;

    var email = emailClaim is null ? string.Empty : emailClaim;
    var name = nameClaim
        ?? (string.IsNullOrWhiteSpace(email) ? "Authenticated user" : email);
    var avatarUrl = avatarClaim ?? string.Empty;

    var user = await dbContext.Users
        .Include(currentUser => currentUser.Owner)
        .FirstOrDefaultAsync(currentUser => currentUser.Auth0Subject == auth0Subject);

    if (user is null)
    {
        user = new User
        {
            Id = Guid.NewGuid(),
            Auth0Subject = auth0Subject,
            Email = email,
            Name = name,
            AvatarUrl = avatarUrl,
            LastLoginAtUtc = DateTime.UtcNow
        };

        dbContext.Users.Add(user);
    }
    else
    {
        user.Email = email;
        user.Name = name;
        user.AvatarUrl = avatarUrl;
        user.LastLoginAtUtc = DateTime.UtcNow;
    }

    if (user.Owner is null)
    {
        var ownerName = await CreateUniqueOwnerNameAsync(name, dbContext);
        dbContext.Owners.Add(new Owner
        {
            Id = Guid.NewGuid(),
            User = user,
            Name = ownerName,
            Initials = CreateInitials(ownerName)
        });
    }

    await dbContext.SaveChangesAsync();

    return user;
}

static async Task<string> CreateUniqueOwnerNameAsync(string name, AppDbContext dbContext)
{
    var baseName = string.IsNullOrWhiteSpace(name) ? "User" : name.Trim();
    var candidate = baseName;
    var suffix = 2;

    while (await dbContext.Owners.AnyAsync(owner => owner.Name.ToLower() == candidate.ToLower()))
    {
        candidate = $"{baseName} {suffix}";
        suffix++;
    }

    return candidate;
}

static UserResponse ToUserResponse(User user) =>
    new(
        user.Id,
        user.Email,
        user.Name,
        user.AvatarUrl,
        user.Owner?.Id,
        user.IsActive,
        user.CreatedAtUtc,
        user.LastLoginAtUtc);

static OwnerResponse ToOwnerResponse(Owner owner) =>
    new(owner.Id, owner.Name, owner.Initials, owner.CreatedAtUtc);

static ProjectResponse ToProjectResponse(Project project)
{
    var issues = project.TodoItems;
    var doneCount = issues.Count(issue => issue.Status == "Done");

    return new ProjectResponse(
        project.Id,
        project.Name,
        project.Description,
        issues.Count,
        doneCount,
        project.CreatedAtUtc);
}

static ProjectDetailResponse ToProjectDetailResponse(Project project) =>
    new(
        project.Id,
        project.Name,
        project.Description,
        project.TodoItems.Count,
        project.TodoItems.Count(issue => issue.Status == "Done"),
        project.CreatedAtUtc,
        project.TodoItems
            .OrderBy(issue => issue.IssueNumber)
            .Select(ToIssueResponse)
            .ToList());

static IssueResponse ToIssueResponse(TodoItem issue)
{
    var codePrefix = issue.Owner?.Initials;

    if (string.IsNullOrWhiteSpace(codePrefix))
    {
        codePrefix = "ISS";
    }

    return new IssueResponse(
        issue.Id,
        issue.IssueNumber,
        $"{codePrefix}-{issue.IssueNumber}",
        issue.Title,
        issue.Description,
        issue.Status,
        issue.IsCompleted,
        issue.ProjectId,
        issue.Project?.Name ?? string.Empty,
        issue.OwnerId,
        issue.Owner is null ? null : ToOwnerResponse(issue.Owner),
        issue.CreatedAtUtc);
}

static async Task<TodoItem?> LoadIssueAsync(Guid id, AppDbContext dbContext) =>
    await dbContext.TodoItems
        .Include(issue => issue.Owner)
        .Include(issue => issue.Project)
        .FirstOrDefaultAsync(issue => issue.Id == id);

static async Task<int> GetNextIssueNumberAsync(AppDbContext dbContext)
{
    var lastIssueNumber = await dbContext.TodoItems
        .Select(issue => (int?)issue.IssueNumber)
        .MaxAsync();

    return (lastIssueNumber ?? 0) + 1;
}

static async Task<IResult?> ValidateIssueRequestAsync(
    string? title,
    string? status,
    Guid projectId,
    Guid? ownerId,
    AppDbContext dbContext)
{
    var normalizedStatus = NormalizeStatus(status);
    var errors = new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(title))
    {
        errors[nameof(title)] = ["Title is required."];
    }

    if (!IssueStatusCatalog.All.Contains(normalizedStatus))
    {
        errors[nameof(status)] = ["Status does not exist."];
    }

    if (!await dbContext.Projects.AnyAsync(project => project.Id == projectId))
    {
        errors[nameof(projectId)] = ["Project does not exist."];
    }

    if (ownerId is not null &&
        !await dbContext.Owners.AnyAsync(owner => owner.Id == ownerId))
    {
        errors[nameof(ownerId)] = ["Assignee does not exist."];
    }

    return errors.Count > 0 ? Results.ValidationProblem(errors) : null;
}

static string NormalizeStatus(string? status)
{
    var candidate = status?.Trim();

    if (string.IsNullOrWhiteSpace(candidate))
    {
        return "Todo";
    }

    return IssueStatusCatalog.All.FirstOrDefault(
        knownStatus => string.Equals(knownStatus, candidate, StringComparison.OrdinalIgnoreCase)) ?? candidate;
}

static bool IsCompletedStatus(string status) =>
    string.Equals(status, "Done", StringComparison.OrdinalIgnoreCase);

static string CreateInitials(string name)
{
    var initials = string.Concat(name
        .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Take(2)
        .Select(part => part[0])).ToUpperInvariant();

    return initials.Length > 0 ? initials[..Math.Min(initials.Length, 4)] : "OWN";
}

public sealed record CreateOwnerRequest(string? Name);
public sealed record SyncCurrentUserRequest(string? Email, string? Name, string? AvatarUrl);
public sealed record UserResponse(
    Guid Id,
    string Email,
    string Name,
    string AvatarUrl,
    Guid? OwnerId,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime LastLoginAtUtc);
public sealed record OwnerResponse(Guid Id, string Name, string Initials, DateTime CreatedAtUtc);
public sealed record CreateProjectRequest(string? Name, string? Description);
public sealed record UpdateProjectRequest(string? Name, string? Description);
public sealed record ProjectResponse(Guid Id, string Name, string Description, int IssueCount, int DoneIssueCount, DateTime CreatedAtUtc);
public sealed record ProjectDetailResponse(Guid Id, string Name, string Description, int IssueCount, int DoneIssueCount, DateTime CreatedAtUtc, List<IssueResponse> Issues);
public sealed record CreateIssueRequest(string? Title, string? Description, string? Status, Guid ProjectId, Guid? OwnerId);
public sealed record UpdateIssueRequest(string? Title, string? Description, string? Status, Guid ProjectId, Guid? OwnerId);
public sealed record UpdateIssueStatusRequest(string? Status);
public sealed record IssueResponse(
    Guid Id,
    int IssueNumber,
    string Code,
    string Title,
    string Description,
    string Status,
    bool IsCompleted,
    Guid ProjectId,
    string ProjectName,
    Guid? OwnerId,
    OwnerResponse? Owner,
    DateTime CreatedAtUtc);

public static class IssueStatusCatalog
{
    public static readonly string[] All = ["Backlog", "Todo", "In Progress", "Done"];
}
