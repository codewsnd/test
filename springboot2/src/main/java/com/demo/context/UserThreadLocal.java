package com.demo.context;

import com.demo.model.User;

public class UserThreadLocal {
    private static final ThreadLocal<User> userThreadLocal = new ThreadLocal<>();

    public static void setUser(User user) {
        userThreadLocal.set(user);
    }

    public static User getUser() {
        return userThreadLocal.get();
    }

    public static String getUserId() {
        User user = userThreadLocal.get();
        return user != null ? user.getId() : null;
    }

    public static String getStaffId() {
        User user = userThreadLocal.get();
        return user != null ? user.getStaffId() : null;
    }

    public static void clear() {
        userThreadLocal.remove();
    }
}