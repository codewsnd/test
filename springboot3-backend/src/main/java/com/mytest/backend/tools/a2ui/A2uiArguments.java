package com.mytest.backend.tools.a2ui;

import java.util.Map;

public final class A2uiArguments {

    private A2uiArguments() {
    }

    public static String optionalString(Map<String, Object> arguments, String key) {
        Object value = arguments.get(key);
        return value == null ? null : String.valueOf(value);
    }
}
