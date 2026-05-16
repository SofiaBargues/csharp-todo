using Microsoft.EntityFrameworkCore;
using Todo.Domain.Entities;

namespace Todo.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Owner> Owners => Set<Owner>();
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
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(owner => owner.Name)
                .IsUnique();
        });

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
            entity.Property(item => item.DueDate);
            entity.Property(item => item.OwnerId);
            entity.HasOne(item => item.Owner)
                .WithMany(owner => owner.TodoItems)
                .HasForeignKey(item => item.OwnerId)
                .OnDelete(DeleteBehavior.SetNull);
            
            entity.Property(item => item.CreatedAtUtc)
                .HasDefaultValueSql("GETUTCDATE()");        
        });
    }
}
