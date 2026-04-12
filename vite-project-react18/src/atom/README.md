# 全局 Staff ID 功能说明

## 实现完成

已成功实现全局 Staff ID 管理功能：

### 1. 创建了全局 Atom (`src/atom/globalAtom.ts`)

```typescript
import { atom } from 'jotai';

export const globalStaffIdAtom = atom<string>('');
```

### 2. 在 main.tsx 中初始化 Staff ID

```typescript
import { getDefaultStore } from 'jotai';
import { globalStaffIdAtom } from './atom/globalAtom';

// 设置全局 Staff ID
const store = getDefaultStore();
store.set(globalStaffIdAtom, '123456123');
```

### 3. 在 userUtils.ts 中获取 Staff ID

```typescript
import { getDefaultStore } from 'jotai';
import { globalStaffIdAtom } from '../atom/globalAtom';

export const getStaffId = (): string => {
  const store = getDefaultStore();
  const staffId = store.get(globalStaffIdAtom);
  return staffId || '12345678'; // 如果未设置，返回默认值
};
```

## 使用方式

在任何地方调用 `getStaffId()` 都会返回 `'123456123'`：

```typescript
import { getStaffId } from './utils/userUtils';

const staffId = getStaffId(); // 返回 '123456123'
```

## 已经使用的地方

以下位置已经在使用 `getStaffId()`：

1. **TestCaseForm.tsx**
   - 第 195 行: `assignee: getStaffId()`
   - 第 297 行: `staffId: getStaffId()`
   - 第 322 行: `staffId: getStaffId()`

2. **conversationHistoryAtom.ts**
   - 多处使用 `getEmployeeId()` (可能需要统一为 `getStaffId()`)

## 优势

1. **集中管理**: Staff ID 在应用启动时统一设置
2. **易于访问**: 任何工具函数都可以通过 `getStaffId()` 获取
3. **类型安全**: TypeScript 类型检查
4. **可维护**: 如果需要修改 Staff ID 的来源（如从 API 获取），只需修改 main.tsx 中的初始化代码

## 后续优化建议

1. 可以从 localStorage 或 Cookie 中读取 Staff ID
2. 可以从后端 API 获取用户信息后设置
3. 可以添加设置 Staff ID 的工具函数：

```typescript
export const setStaffId = (staffId: string): void => {
  const store = getDefaultStore();
  store.set(globalStaffIdAtom, staffId);
};
```
