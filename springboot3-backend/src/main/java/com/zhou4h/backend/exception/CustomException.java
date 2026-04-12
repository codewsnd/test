package com.zhou4h.backend.exception;

import lombok.Getter;

public class CustomException extends RuntimeException {

    @Getter
    private int code;

    @Getter
    private String message;

    public CustomException(int code, String message) {
        super(message);
        this.code = code;
        this.message = message;
    }

}
