namespace Todo.Domain.Entities;

public sealed class Owner
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Initials { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public List<TodoItem> TodoItems { get; set; } = [];
}
