namespace Todo.Domain.Entities;

public sealed class TodoItem
{
    public Guid Id { get; set; }
    public int IssueNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsCompleted { get; set; }
    public string Status { get; set; } = "Todo";
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;
    public Guid? OwnerId { get; set; }
    public Owner? Owner { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
