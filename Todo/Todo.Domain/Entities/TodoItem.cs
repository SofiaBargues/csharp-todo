namespace Todo.Domain.Entities;

public sealed class TodoItem
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public bool IsCompleted { get; set; }
    public string Section { get; set; } = string.Empty;
    public DateOnly? DueDate { get; set; }
    public Guid? OwnerId { get; set; }
    public Owner? Owner { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
