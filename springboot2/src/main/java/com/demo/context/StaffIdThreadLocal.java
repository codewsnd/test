package com.demo.context;

public class StaffIdThreadLocal {
    private static final ThreadLocal<String> staffIdThreadLocal = new ThreadLocal<>();

    public static void setStaffId(String staffId) {
        staffIdThreadLocal.set(staffId);
    }

    public static String getStaffId() {
        return staffIdThreadLocal.get();
    }

    public static void clear() {
        staffIdThreadLocal.remove();
    }
}
