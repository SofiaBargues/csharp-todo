using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Todo.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectsAndIssuePages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DueDate",
                table: "TodoItems");

            migrationBuilder.RenameColumn(
                name: "Section",
                table: "TodoItems",
                newName: "Status");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAtUtc",
                table: "TodoItems",
                type: "TEXT",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP",
                oldClrType: typeof(DateTime),
                oldType: "TEXT",
                oldDefaultValueSql: "GETUTCDATE()");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "TodoItems",
                type: "TEXT",
                maxLength: 8000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "IssueNumber",
                table: "TodoItems",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "ProjectId",
                table: "TodoItems",
                type: "TEXT",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAtUtc",
                table: "Owners",
                type: "TEXT",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP",
                oldClrType: typeof(DateTime),
                oldType: "TEXT",
                oldDefaultValueSql: "GETUTCDATE()");

            migrationBuilder.CreateTable(
                name: "Projects",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: false, defaultValue: ""),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Projects", x => x.Id);
                });

            migrationBuilder.Sql("""
                INSERT INTO Projects (Id, Name, Description, CreatedAtUtc)
                VALUES ('11111111-1111-1111-1111-111111111111', 'Alpha', 'Default product workspace.', CURRENT_TIMESTAMP);
                """);

            migrationBuilder.Sql("""
                UPDATE TodoItems
                SET
                    ProjectId = '11111111-1111-1111-1111-111111111111',
                    IssueNumber = rowid,
                    Status = CASE
                        WHEN IsCompleted = 1 THEN 'Done'
                        WHEN Status IN ('Backlog', 'Todo', 'In Progress') THEN Status
                        ELSE 'Todo'
                    END;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_TodoItems_IssueNumber",
                table: "TodoItems",
                column: "IssueNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TodoItems_ProjectId",
                table: "TodoItems",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Projects_Name",
                table: "Projects",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_TodoItems_Projects_ProjectId",
                table: "TodoItems",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TodoItems_Projects_ProjectId",
                table: "TodoItems");

            migrationBuilder.DropTable(
                name: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_TodoItems_IssueNumber",
                table: "TodoItems");

            migrationBuilder.DropIndex(
                name: "IX_TodoItems_ProjectId",
                table: "TodoItems");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "TodoItems");

            migrationBuilder.DropColumn(
                name: "IssueNumber",
                table: "TodoItems");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "TodoItems");

            migrationBuilder.RenameColumn(
                name: "Status",
                table: "TodoItems",
                newName: "Section");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAtUtc",
                table: "TodoItems",
                type: "TEXT",
                nullable: false,
                defaultValueSql: "GETUTCDATE()",
                oldClrType: typeof(DateTime),
                oldType: "TEXT",
                oldDefaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AddColumn<DateOnly>(
                name: "DueDate",
                table: "TodoItems",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAtUtc",
                table: "Owners",
                type: "TEXT",
                nullable: false,
                defaultValueSql: "GETUTCDATE()",
                oldClrType: typeof(DateTime),
                oldType: "TEXT",
                oldDefaultValueSql: "CURRENT_TIMESTAMP");
        }
    }
}
