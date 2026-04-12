// 通过 Ant Design Table 的 rowClassName 能力统一生成隔行换色类名。
function getStripedTableRowClassName(_record: unknown, index: number): string {
  return index % 2 === 1 ? 'tool-table-row-alt' : ''
}

export default getStripedTableRowClassName
