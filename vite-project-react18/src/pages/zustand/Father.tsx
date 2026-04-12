// src/components/Father.tsx
import { Button } from "antd";
import { useUserStore } from "./userStore";
import { UserList } from "./UserList";

export const Father = () => {
  const {
    text,
    setText,
    updateUser1Lat,
    updateUser2Lng
  } = useUserStore();

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20, padding: 15, backgroundColor: '#f0f9ff', borderRadius: 8 }}>
        <h3>Father Page</h3>
        <p>text: {text}</p>
        <Button
          type="primary"
          onClick={() => setText('我更新了')}
          style={{ marginRight: 10 }}
        >
          我也来更新
        </Button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <UserList />

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Button type="primary" onClick={updateUser1Lat}>
            更新用户1的Lat
          </Button>
          <Button type="primary" onClick={updateUser2Lng}>
            更新用户2的Lng
          </Button>
        </div>
      </div>
    </div>
  );
};
