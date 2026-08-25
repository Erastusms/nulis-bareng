-- CreateIndex
CREATE INDEX "boards_workspace_id_position_idx" ON "boards"("workspace_id", "position");

-- CreateIndex
CREATE INDEX "board_columns_board_id_position_idx" ON "board_columns"("board_id", "position");

-- CreateIndex
CREATE INDEX "cards_column_id_position_idx" ON "cards"("column_id", "position");

-- CreateIndex
CREATE INDEX "cards_board_id_position_idx" ON "cards"("board_id", "position");
