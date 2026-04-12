# 在工具函数中访问 Jotai 数据的方法

## 方法 1: 使用 `getDefaultStore()` (推荐)

这是在 React 组件外部访问 jotai atom 的标准方法。

```typescript
import { getDefaultStore } from 'jotai';
import { userAtom } from '../atoms/userAtom';

export const getUserInfo = () => {
  const store = getDefaultStore();
  const user = store.get(userAtom);
  return user;
};

// 设置 atom 的值
export const setUserInfo = (newUser: User) => {
  const store = getDefaultStore();
  store.set(userAtom, newUser);
};
```

## 方法 2: 传递 atom 作为参数

将 atom 值从组件传递到工具函数：

```typescript
// userUtils.ts
export const processUserData = (userId: string) => {
  // 使用传入的值进行处理
  return `Processing user: ${userId}`;
};

// 在组件中使用
const MyComponent = () => {
  const [userId] = useAtom(userIdAtom);
  const result = processUserData(userId); // 将 atom 的值传递进去
};
```

## 方法 3: 创建自定义 Provider

如果需要更复杂的状态管理，可以创建自定义的 store：

```typescript
// store.ts
import { createStore } from 'jotai';

export const myStore = createStore();

// 在 App.tsx 中使用
import { Provider } from 'jotai';
import { myStore } from './store';

function App() {
  return (
    <Provider store={myStore}>
      <YourComponents />
    </Provider>
  );
}

// 在工具函数中使用
import { myStore } from './store';
import { userAtom } from './atoms';

export const getUserFromStore = () => {
  return myStore.get(userAtom);
};
```

## 实际示例：在 excelUtils.ts 中使用

```typescript
import { getDefaultStore } from 'jotai';
import { userPreferencesAtom } from '../atoms/userAtom';
import * as XLSX from 'xlsx';

export const importFromExcel = async (file: File) => {
  // 获取用户偏好设置
  const store = getDefaultStore();
  const userPrefs = store.get(userPreferencesAtom);

  // 根据用户偏好进行处理
  const config = {
    requiredHeaders: userPrefs.defaultHeaders || [],
    strictMatch: userPrefs.strictHeaderMatch || false,
  };

  // ... 其余导入逻辑
};
```

## 注意事项

1. **`getDefaultStore()` 只在默认 Provider 下工作**
   - 如果你使用了自定义的 `<Provider store={customStore}>`，需要使用那个 store

2. **同步访问**
   - `store.get()` 是同步的，立即返回当前值
   - 适合在工具函数中使用

3. **订阅变化**
   ```typescript
   const store = getDefaultStore();
   const unsubscribe = store.sub(myAtom, () => {
     console.log('atom changed:', store.get(myAtom));
   });
   // 记得取消订阅
   unsubscribe();
   ```

4. **性能考虑**
   - 如果工具函数频繁调用，考虑将 atom 值作为参数传递，而不是每次都从 store 获取
