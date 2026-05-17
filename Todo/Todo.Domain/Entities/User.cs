namespace Todo.Domain.Entities;

public sealed class User
{
    public Guid Id { get; set; }
    public string Auth0Subject { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string AvatarUrl { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime LastLoginAtUtc { get; set; } = DateTime.UtcNow;
    public Owner? Owner { get; set; }
}
