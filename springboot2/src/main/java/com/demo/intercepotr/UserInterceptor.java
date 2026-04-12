package com.demo.intercepotr;

import com.demo.context.UserThreadLocal;
import com.demo.model.User;
import com.demo.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@Slf4j
@Component
public class UserInterceptor implements HandlerInterceptor {

    @Autowired
    private UserService userService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String staffId = getStaffId(request);
        User user = userService.getUserByStaffId(staffId);
        UserThreadLocal.setUser(user);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler,
                                Exception ex) {
        UserThreadLocal.clear();
        log.debug("User ThreadLocal cleared");
    }

    private String getStaffId(HttpServletRequest request) {
        String staffId = request.getHeader("uid");
        if (StringUtils.isEmpty(staffId)) {
            throw new RuntimeException("User ID not found in request header 'uid'");
        }
        return staffId;
    }
}
