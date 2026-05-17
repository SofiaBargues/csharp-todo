using Microsoft.EntityFrameworkCore;
using Todo.Domain.Entities;

namespace Todo.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Owner> Owners => Set<Owner>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<TodoItem> TodoItems => Set<TodoItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Owner>(entity =>
        {
            entity.ToTable("Owners");

            entity.HasKey(owner => owner.Id);

            entity.Property(owner => owner.Name)
                .HasMaxLength(100)
                .IsRequired();
            entity.Property(owner => owner.Initials)
                .HasMaxLength(4)
                .IsRequired();
            entity.Property(owner => owner.CreatedAtUtc)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.HasIndex(owner => owner.Name)
                .IsUnique();
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.ToTable("Projects");

            entity.HasKey(project => project.Id);

            entity.Property(project => project.Name)
                .HasMaxLength(120)
                .IsRequired();
            entity.Property(project => project.Description)
                .HasMaxLength(2000)
                .HasDefaultValue(string.Empty);
            entity.Property(project => project.CreatedAtUtc)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.HasIndex(project => project.Name)
                .IsUnique();
        });

        modelBuilder.Entity<TodoItem>(entity =>
        {
            entity.ToTable("TodoItems");
         
            entity.HasKey(item => item.Id);

            entity.Property(item => item.IssueNumber)
                .IsRequired();
         
            entity.Property(item => item.Title)
                .HasMaxLength(160)
                .IsRequired();
            entity.Property(item => item.Description)
                .HasMaxLength(8000)
                .HasDefaultValue(string.Empty);
            entity.Property(item => item.Status)
                .HasMaxLength(100)
                .IsRequired();
            entity.Property(item => item.IsCompleted)
                .HasDefaultValue(false);
            entity.Property(item => item.ProjectId);
            entity.Property(item => item.OwnerId);
            entity.HasOne(item => item.Project)
                .WithMany(project => project.TodoItems)
                .HasForeignKey(item => item.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(item => item.Owner)
                .WithMany(owner => owner.TodoItems)
                .HasForeignKey(item => item.OwnerId)
                .OnDelete(DeleteBehavior.SetNull);
            
            entity.Property(item => item.CreatedAtUtc)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.HasIndex(item => item.IssueNumber)
                .IsUnique();
        });
    }
}
