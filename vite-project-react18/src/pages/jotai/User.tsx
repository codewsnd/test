import React, { Suspense } from 'react';
import {
  atom,
  useAtom,
  useAtomValue,
  useSetAtom,
  Provider,
  createStore
} from 'jotai';
import {
  atomWithStorage,
  atomWithReset,
  atomFamily,
  RESET,
  loadable
} from 'jotai/utils';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  website: string;
  company: {
    name: string;
  };
  address?: {
    street: string;
    suite: string;
    city: string;
    zipcode: string;
    geo: {
      lat: string;
      lng: string;
    }
  }
}

// 1. 基础 atom
const countAtom = atom(0);
const nameAtom = atom('Jotai Demo');

// 2. 只读派生 atom
const doubleCountAtom = atom((get) => get(countAtom) * 2);

// 3. 可写派生 atom
const upperCaseNameAtom = atom(
  (get) => get(nameAtom).toUpperCase(),
  (get, set, newValue: string) => {
    set(nameAtom, newValue);
  }
);

// 4. 异步 atom - 模拟 API 调用
const userListAtom = atom(async (): Promise<User[]> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return [
    {
      id: 1,
      name: 'Leanne Graham',
      email: 'Sincere@april.biz',
      phone: '1-770-736-8031 x56442',
      website: 'hildegard.org',
      company: {
        name: 'Romaguera-Crona'
      },
      address: {
        street: 'Kulas Light',
        suite: 'Apt. 556',
        city: 'Gwenborough',
        zipcode: '92998-3874',
        geo: {
          lat: '-37.3159',
          lng: '81.1496'
        }
      }
    },
    {
      id: 2,
      name: 'Ervin Howell',
      email: 'Shanna@melissa.tv',
      phone: '010-692-6593 x09125',
      website: 'anastasia.net',
      company: {
        name: 'Deckow-Crist'
      }
    }
  ];
});

// 5. 使用 loadable 处理异步状态
const loadableUserListAtom = loadable(userListAtom);

// 6. atomWithStorage - 持久化到 localStorage
const themeAtom = atomWithStorage('theme', 'light');

// 7. atomWithReset - 可重置的 atom
const resetableCountAtom = atomWithReset(0);

// 8. atomFamily - 动态创建 atom
const todoAtomFamily = atomFamily((id: number) =>
  atom({ id, text: `Todo ${id}`, completed: false })
);

// 9. 复杂的异步 atom with dependency
const userDetailAtom = atom(async (get) => {
  const users = await get(userListAtom);
  const selectedId = get(selectedUserIdAtom);
  return users.find(user => user.id === selectedId);
});

const selectedUserIdAtom = atom(1);

// 10. 条件 atom
const isEvenCountAtom = atom((get) => get(countAtom) % 2 === 0);

// 基础 atom 演示组件
const BasicAtomDemo = () => {
  const [count, setCount] = useAtom(countAtom);
  const [name, setName] = useAtom(nameAtom);
  const doubleCount = useAtomValue(doubleCountAtom);

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, margin: 8, borderRadius: 8 }}>
      <h4>1. 基础 Atom 演示</h4>
      <div>计数: {count}</div>
      <div>双倍计数: {doubleCount}</div>
      <button onClick={() => setCount(c => c + 1)}>增加</button>
      <button onClick={() => setCount(c => c - 1)} style={{ marginLeft: 8 }}>减少</button>

      <div style={{ marginTop: 16 }}>
        <div>姓名: {name}</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="输入姓名"
        />
      </div>
    </div>
  );
};

// 派生 atom 演示组件
const DerivedAtomDemo = () => {
  const [upperName, setUpperName] = useAtom(upperCaseNameAtom);
  const isEven = useAtomValue(isEvenCountAtom);
  const count = useAtomValue(countAtom);

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, margin: 8, borderRadius: 8 }}>
      <h4>2. 派生 Atom 演示</h4>
      <div>大写姓名: {upperName}</div>
      <input
        value={upperName}
        onChange={(e) => setUpperName(e.target.value)}
        placeholder="输入姓名 (自动转大写)"
      />

      <div style={{ marginTop: 16 }}>
        <div>当前计数: {count}</div>
        <div>是否为偶数: {isEven ? '是' : '否'}</div>
      </div>
    </div>
  );
};

// 异步 atom 演示组件
const AsyncAtomDemo = () => {
  const userListLoadable = useAtomValue(loadableUserListAtom);

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, margin: 8, borderRadius: 8 }}>
      <h4>3. 异步 Atom 演示</h4>
      {userListLoadable.state === 'loading' && <div>加载用户列表中...</div>}
      {userListLoadable.state === 'hasError' && <div>加载失败: {userListLoadable.error}</div>}
      {userListLoadable.state === 'hasData' && (
        <div>
          <div>用户列表 ({userListLoadable.data.length} 个用户):</div>
          {userListLoadable.data.map(user => (
            <div key={user.id} style={{ marginLeft: 16, padding: 8, backgroundColor: '#f5f5f5', margin: '4px 0' }}>
              {user.name} - {user.email}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Storage atom 演示组件
const StorageAtomDemo = () => {
  const [theme, setTheme] = useAtom(themeAtom);

  return (
    <div style={{
      border: '1px solid #ddd',
      padding: 16,
      margin: 8,
      borderRadius: 8,
      backgroundColor: theme === 'dark' ? '#333' : '#fff',
      color: theme === 'dark' ? '#fff' : '#000'
    }}>
      <h4>4. Storage Atom 演示 (持久化)</h4>
      <div>当前主题: {theme}</div>
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        切换主题
      </button>
      <div style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>
        刷新页面后主题设置会保持
      </div>
    </div>
  );
};

// Reset atom 演示组件
const ResetAtomDemo = () => {
  const [resetableCount, setResetableCount] = useAtom(resetableCountAtom);

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, margin: 8, borderRadius: 8 }}>
      <h4>5. Reset Atom 演示</h4>
      <div>可重置计数: {resetableCount}</div>
      <button onClick={() => setResetableCount(c => c + 1)}>增加</button>
      <button onClick={() => setResetableCount(RESET)} style={{ marginLeft: 8 }}>
        重置
      </button>
    </div>
  );
};

// AtomFamily 演示组件
const AtomFamilyDemo = () => {
  const [todo1] = useAtom(todoAtomFamily(1));
  const [todo2] = useAtom(todoAtomFamily(2));
  const [todo3] = useAtom(todoAtomFamily(3));

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, margin: 8, borderRadius: 8 }}>
      <h4>6. Atom Family 演示</h4>
      <div>Todo 1: {todo1.text} - {todo1.completed ? '已完成' : '未完成'}</div>
      <div>Todo 2: {todo2.text} - {todo2.completed ? '已完成' : '未完成'}</div>
      <div>Todo 3: {todo3.text} - {todo3.completed ? '已完成' : '未完成'}</div>
    </div>
  );
};

// 用户详情演示组件
const UserDetailDemo = () => {
  const [selectedId, setSelectedId] = useAtom(selectedUserIdAtom);

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, margin: 8, borderRadius: 8 }}>
      <h4>7. 依赖异步 Atom 演示</h4>
      <div>选择用户 ID:
        <select value={selectedId} onChange={(e) => setSelectedId(Number(e.target.value))}>
          <option value={1}>用户 1</option>
          <option value={2}>用户 2</option>
        </select>
      </div>

      <Suspense fallback={<div>加载用户详情中...</div>}>
        <UserDetailDisplay />
      </Suspense>
    </div>
  );
};

const UserDetailDisplay = () => {
  const userDetail = useAtomValue(userDetailAtom);

  if (!userDetail) {
    return <div>未找到用户</div>;
  }

  return (
    <div style={{ marginTop: 8, padding: 8, backgroundColor: '#f9f9f9' }}>
      <div><strong>姓名:</strong> {userDetail.name}</div>
      <div><strong>邮箱:</strong> {userDetail.email}</div>
      <div><strong>电话:</strong> {userDetail.phone}</div>
      <div><strong>网站:</strong> {userDetail.website}</div>
      <div><strong>公司:</strong> {userDetail.company.name}</div>
      {userDetail.address && (
        <div><strong>地址:</strong> {userDetail.address.city}</div>
      )}
    </div>
  );
};

// 创建一个独立的 store 用于演示
const myStore = createStore();

// Store 演示组件
const StoreDemo = () => {
  return (
    <div style={{ border: '1px solid #ddd', padding: 16, margin: 8, borderRadius: 8 }}>
      <h4>8. 独立 Store 演示</h4>
      <Provider store={myStore}>
        <div style={{ padding: 8, backgroundColor: '#f0f0f0' }}>
          <div>这个计数器使用独立的 store:</div>
          <BasicAtomDemo />
        </div>
      </Provider>
    </div>
  );
};

// 主组件
export const User = () => {
  return (
    <div style={{ padding: 20, maxWidth: 1200 }}>
      <h2>Jotai 完整功能演示</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
        <BasicAtomDemo />
        <DerivedAtomDemo />
        <AsyncAtomDemo />
        <StorageAtomDemo />
        <ResetAtomDemo />
        <AtomFamilyDemo />
        <UserDetailDemo />
        <StoreDemo />
      </div>

      <div style={{ marginTop: 32, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
        <h3>Jotai 功能清单</h3>
        <ul>
          <li>✅ 基础 atom (atom, useAtom, useAtomValue, useSetAtom)</li>
          <li>✅ 派生 atom (只读和可写)</li>
          <li>✅ 异步 atom (Promise)</li>
          <li>✅ loadable (异步状态处理)</li>
          <li>✅ atomWithStorage (持久化)</li>
          <li>✅ atomWithReset (可重置)</li>
          <li>✅ atomFamily (动态创建)</li>
          <li>✅ Provider 和独立 store</li>
          <li>✅ Suspense 集成</li>
          <li>✅ 条件派生 atom</li>
          <li>✅ 复杂依赖关系</li>
        </ul>
      </div>
    </div>
  );
};