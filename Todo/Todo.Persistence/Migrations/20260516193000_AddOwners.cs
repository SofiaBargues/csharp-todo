using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Todo.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOwners : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Owners",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Initials = table.Column<string>(type: "TEXT", maxLength: 4, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Owners", x => x.Id);
                });

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerId",
                table: "TodoItems",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TodoItems_OwnerId",
                table: "TodoItems",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_Owners_Name",
                table: "Owners",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_TodoItems_Owners_OwnerId",
                table: "TodoItems",
                column: "OwnerId",
                principalTable: "Owners",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TodoItems_Owners_OwnerId",
                table: "TodoItems");

            migrationBuilder.DropTable(
                name: "Owners");

            migrationBuilder.DropIndex(
                name: "IX_TodoItems_OwnerId",
                table: "TodoItems");

            migrationBuilder.DropColumn(
                name: "OwnerId",
                table: "TodoItems");
        }
    }
}
