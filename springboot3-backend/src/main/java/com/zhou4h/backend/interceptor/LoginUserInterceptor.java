package com.zhou4h.backend.interceptor;

import com.zhou4h.backend.config.LoginUserInfo;
import com.zhou4h.backend.config.LoginUserThreadLocal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@Slf4j
public class LoginUserInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        try {
            LoginUserInfo loginUserInfo = new LoginUserInfo();
            loginUserInfo.setEmployeeId("123");
            LoginUserThreadLocal.set(loginUserInfo);
            return true;
        } catch (Exception e) {
            LoginUserThreadLocal.remove();
            throw e;
        }
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) throws Exception {
        try {
            if (ex != null) {
                log.error("Request processing failed in LoginUserInterceptor", ex);
            }
        } finally {
            LoginUserThreadLocal.remove();
        }
    }
}
