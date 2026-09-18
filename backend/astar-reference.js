/**
 * Module A* — tìm đường đi tối ưu trên bản đồ lưới bãi xe.
 *
 * Input:
 *  - grid: mảng 2 chiều walkable[row][col] = true/false (obstacle = false)
 *  - start: {row, col}
 *  - goal: {row, col}  (vị trí slot đích)
 *
 * Output:
 *  - path: [{row, col}, ...] từ start đến goal (rỗng nếu không có đường)
 *  - distance: số bước đi
 *
 * QUAN TRỌNG: hệ tọa độ (row, col) ở đây phải khớp 100% với hệ tọa độ
 * Frontend dùng để vẽ bản đồ (row = 0 ở trên cùng, col = 0 bên trái).
 * Thống nhất chỗ này ngay từ đầu, không để mỗi bên tự hiểu 1 kiểu.
 */

function heuristic(a, b) {
  // Manhattan distance — phù hợp vì xe chỉ di chuyển ngang/dọc trong bãi (không đi chéo)
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function key(node) {
  return `${node.row},${node.col}`;
}

function getNeighbors(node, grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const deltas = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];
  const neighbors = [];
  for (const d of deltas) {
    const r = node.row + d.row;
    const c = node.col + d.col;
    if (r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] === true) {
      neighbors.push({ row: r, col: c });
    }
  }
  return neighbors;
}

/**
 * findPath: A* chuẩn dùng priority queue đơn giản (mảng + sort, đủ dùng cho
 * lưới bãi xe cỡ nhỏ/vừa; nếu bãi quá lớn (>10k ô) nên thay bằng binary heap).
 */
function findPath(grid, start, goal) {
  if (!grid[start.row]?.[start.col] || !grid[goal.row]?.[goal.col]) {
    throw new Error("Start hoặc goal nằm ngoài lưới hoặc là obstacle");
  }

  const openSet = [start];
  const cameFrom = new Map();

  const gScore = new Map();
  gScore.set(key(start), 0);

  const fScore = new Map();
  fScore.set(key(start), heuristic(start, goal));

  while (openSet.length > 0) {
    // Lấy node có fScore thấp nhất trong openSet
    openSet.sort((a, b) => (fScore.get(key(a)) ?? Infinity) - (fScore.get(key(b)) ?? Infinity));
    const current = openSet.shift();

    if (current.row === goal.row && current.col === goal.col) {
      return reconstructPath(cameFrom, current);
    }

    for (const neighbor of getNeighbors(current, grid)) {
      const tentativeG = (gScore.get(key(current)) ?? Infinity) + 1;
      if (tentativeG < (gScore.get(key(neighbor)) ?? Infinity)) {
        cameFrom.set(key(neighbor), current);
        gScore.set(key(neighbor), tentativeG);
        fScore.set(key(neighbor), tentativeG + heuristic(neighbor, goal));
        if (!openSet.some((n) => n.row === neighbor.row && n.col === neighbor.col)) {
          openSet.push(neighbor);
        }
      }
    }
  }

  return { path: [], distance: -1 }; // không tìm được đường
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  let k = key(current);
  while (cameFrom.has(k)) {
    current = cameFrom.get(k);
    path.unshift(current);
    k = key(current);
  }
  return { path, distance: path.length - 1 };
}

module.exports = { findPath };

/* ---------------- Ví dụ dùng thử (xóa khi tích hợp thật) ----------------
const grid = [
  [true, true, true, true],
  [true, false, false, true],
  [true, true, true, true],
];
console.log(findPath(grid, { row: 0, col: 0 }, { row: 2, col: 3 }));
--------------------------------------------------------------------------*/
