namespace Todo.Domain.Entities;

public sealed class Owner
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Initials { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public User? User { get; set; }
    public List<TodoItem> TodoItems { get; set; } = [];
}
