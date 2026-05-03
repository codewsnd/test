package com.mytest.backend.config;


import lombok.Data;

public class LoginUserThreadLocal {

    private static final ThreadLocal<LoginUserInfo> THREAD_LOCAL = new ThreadLocal<>();

    public static void set(LoginUserInfo loginUserInfo) {
        THREAD_LOCAL.set(loginUserInfo);
    }

    public static LoginUserInfo get() {
        return THREAD_LOCAL.get();
    }

    public static String getStaffId() {
        LoginUserInfo loginUserInfo = THREAD_LOCAL.get();
        if(loginUserInfo==null || loginUserInfo.getEmployeeId()==null) {
            throw new RuntimeException("StaffId is null");
        }
        return THREAD_LOCAL.get().getEmployeeId();
    }

    public static void remove() {
        THREAD_LOCAL.remove();
    }

}

