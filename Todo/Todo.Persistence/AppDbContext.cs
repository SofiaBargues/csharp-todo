using Microsoft.EntityFrameworkCore;
using Todo.Domain.Entities;

namespace Todo.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<TodoItem> TodoItems => Set<TodoItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TodoItem>(entity =>
        {
            entity.ToTable("TodoItems");
         
            entity.HasKey(item => item.Id);
         
            entity.Property(item => item.Title)
                .HasMaxLength(160)
                .IsRequired();
            entity.Property(item => item.Section)
                .HasMaxLength(100)
                .IsRequired();
            entity.Property(item => item.IsCompleted)
                .HasDefaultValue(false);
            
            entity.Property(item => item.CreatedAtUtc)
                .HasDefaultValueSql("GETUTCDATE()");        
        });
    }
}