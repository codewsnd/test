// src/store/userStore.ts
import { create } from 'zustand'; // 改为命名导入
import type { User } from './UserList';

interface UserState {
  text: string;
  users: Partial<User>[];
  setText: (text: string) => void;
  updateUser1Lat: () => void;
  updateUser2Lng: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  text: '哈哈哈',
  users: [
    {
      id: 1,
      name: 'Leanne Graham',
      email: '<EMAIL>',
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
      email: '<EMAIL>',
      phone: '010-692-6593 x09125',
      website: 'anastasia.net',
    }
  ],

  setText: (text) => set({ text }),

  updateUser1Lat: () => set((state) => ({
    users: state.users.map(user =>
      user.id === 1 && user.address
        ? {
          ...user,
          address: {
            ...user.address,
            geo: {
              ...user.address.geo,
              lat: 'test'
            }
          }
        }
        : user
    )
  })),

  updateUser2Lng: () => set((state) => {
    const users = [...state.users];
    const user2 = users.find(user => user.id === 2);

    if (user2) {
      // 确保 address 对象存在
      if (!user2.address) {
        user2.address = {
          street: '',
          suite: '',
          city: '',
          zipcode: '',
          geo: { lat: '', lng: '' }
        };
      }

      // 确保 geo 对象存在
      if (!user2.address.geo) {
        user2.address.geo = { lat: '', lng: '' };
      }

      // 更新 lng 属性
      user2.address.geo.lng = 'test';
    }

    return { users };
  })
}));
