// src/components/UserList.tsx
import { useUserStore } from './userStore';

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
    };
  };
}

export const UserList = () => {
  const users = useUserStore(state => state.users);

  return (
    <div style={{ border: '1px solid #eee', padding: 15, borderRadius: 8, marginBottom: 20 }}>
      <h3>用户列表</h3>
      {users.map((user) => (
        <div key={user.id} style={{ marginBottom: 15, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 5 }}>
          <div><strong>ID:</strong> {user.id}</div>
          <div><strong>姓名:</strong> {user.name}</div>
          <div><strong>邮箱:</strong> {user.email}</div>
          <div><strong>电话:</strong> {user.phone}</div>
          <div><strong>网站:</strong> {user.website}</div>
          <div><strong>公司:</strong> {user.company?.name}</div>
          {user.address && (
            <div>
              <div><strong>地址:</strong> {user.address.street}, {user.address.suite}, {user.address.city}, {user.address.zipcode}</div>
              <div><strong>经纬度:</strong>
                <span style={{ color: user.id === 1 ? 'red' : 'inherit' }}>
                  Lat: {user.address.geo?.lat}
                </span>,
                <span style={{ color: user.id === 2 ? 'red' : 'inherit' }}>
                  Lng: {user.address.geo?.lng}
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
