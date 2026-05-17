using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace Todo.Persistence.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260517170000_RemoveManualAssignees")]
    public partial class RemoveManualAssignees : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE TodoItems
                SET OwnerId = NULL
                WHERE OwnerId IN (
                    SELECT Id
                    FROM Owners
                    WHERE UserId IS NULL
                );
                """);

            migrationBuilder.Sql("""
                DELETE FROM Owners
                WHERE UserId IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
