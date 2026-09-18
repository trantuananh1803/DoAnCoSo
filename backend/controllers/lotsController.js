const pool = require('../database/db');

async function listLots(req, res) {
  const { rows } = await pool.query(
    'SELECT id, name, address, grid_rows, grid_cols FROM parking_lots ORDER BY name'
  );
  res.json(rows);
}

async function getGrid(req, res) {
  const { id } = req.params;

  const lotRes = await pool.query(
    'SELECT grid_rows, grid_cols FROM parking_lots WHERE id = $1',
    [id]
  );
  if (lotRes.rows.length === 0) return res.status(404).json({ error: 'lot_not_found' });

  const cellsRes = await pool.query(
    `SELECT id, row_idx, col_idx, cell_type, walkable
     FROM grid_cells WHERE lot_id = $1 ORDER BY row_idx, col_idx`,
    [id]
  );

  res.json({
    rows: lotRes.rows[0].grid_rows,
    cols: lotRes.rows[0].grid_cols,
    cells: cellsRes.rows,
  });
}

/**
 * Body mẫu:
 * {
 *   "name": "Bãi A",
 *   "address": "...",
 *   "grid": {
 *     "rows": 5, "cols": 5,
 *     "cells": [
 *       { "row_idx":0, "col_idx":0, "cell_type":"gate" },
 *       { "row_idx":0, "col_idx":1, "cell_type":"slot", "slot_code":"A01" },
 *       { "row_idx":1, "col_idx":1, "cell_type":"obstacle" },
 *       ...
 *     ]
 *   }
 * }
 * Dùng transaction: tạo lot + toàn bộ grid_cells + parking_slots phải all-or-nothing,
 * lỡ giữa chừng lỗi mà không rollback thì có bãi xe với grid nham nhở, A* chạy vô lưới rỗng.
 */
async function createLot(req, res) {
  const { name, address, grid } = req.body;
  if (!name || !grid || !grid.rows || !grid.cols || !Array.isArray(grid.cells)) {
    return res.status(400).json({ error: 'invalid_body' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lotRes = await client.query(
      `INSERT INTO parking_lots (name, address, grid_rows, grid_cols)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [name, address || null, grid.rows, grid.cols]
    );
    const lotId = lotRes.rows[0].id;

    for (const cell of grid.cells) {
      const cellRes = await client.query(
        `INSERT INTO grid_cells (lot_id, row_idx, col_idx, cell_type, walkable)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [lotId, cell.row_idx, cell.col_idx, cell.cell_type, cell.cell_type !== 'obstacle']
      );

      if (cell.cell_type === 'slot') {
        if (!cell.slot_code) {
          throw new Error(`Ô (${cell.row_idx},${cell.col_idx}) là slot nhưng thiếu slot_code`);
        }
        await client.query(
          `INSERT INTO parking_slots (lot_id, grid_cell_id, slot_code, status)
           VALUES ($1,$2,$3,'empty')`,
          [lotId, cellRes.rows[0].id, cell.slot_code]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ lot_id: lotId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: 'create_failed', detail: err.message });
  } finally {
    client.release();
  }
}

module.exports = { listLots, getGrid, createLot };