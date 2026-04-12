package com.demo.intercepotr;

import com.demo.annotation.Permission;
import com.demo.context.UserThreadLocal;
import com.demo.model.User;
import com.demo.repository.GroupRepo;
import com.demo.repository.UserRepo;
import com.demo.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.lang.reflect.Method;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Component
public class PermissionInterceptor implements HandlerInterceptor {

    @Autowired
    private UserService userService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {

        if (!(handler instanceof HandlerMethod)) {
            return true;
        }

        HandlerMethod handlerMethod = (HandlerMethod) handler;
        Method method = handlerMethod.getMethod();

        Permission methodAnnotation = method.getAnnotation(Permission.class);
        Permission classAnnotation = handlerMethod.getBeanType().getAnnotation(Permission.class);

        if (methodAnnotation == null && classAnnotation == null) {
            return true;
        }

        Permission permission = methodAnnotation != null ? methodAnnotation : classAnnotation;
        String requiredGroups = permission.groups();

        try {
            User currentUser = UserThreadLocal.getUser();
            if (currentUser == null) {
                log.warn("Permission denied: No user found in ThreadLocal");
                response.sendError(HttpStatus.UNAUTHORIZED.value(), "Unauthorized: User not authenticated");
                return false;
            }

            Set<String> userGroups = userService.getUserGroupNames(currentUser);
            Set<String> requiredGroupsSet = parseRequiredGroups(requiredGroups);

            if (hasPermission(userGroups, requiredGroupsSet)) {
                log.info("Permission granted for user {} (staffId: {}) accessing {}",
                        currentUser.getId(), currentUser.getStaffId(), method.getName());
                return true;
            } else {
                log.error("Permission denied for user {} (staffId: {}) accessing {}. Required groups: {}, User groups: {}",
                        currentUser.getId(), currentUser.getStaffId(), method.getName(), requiredGroupsSet, userGroups);
                response.sendError(HttpStatus.FORBIDDEN.value(),
                    "Forbidden: Insufficient permissions. Required groups: " + String.join(", ", requiredGroupsSet));
                return false;
            }
        } catch (Exception e) {
            log.error("Error during permission check", e);
            response.sendError(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Internal Server Error");
            return false;
        }
    }

    private Set<String> parseRequiredGroups(String requiredGroups) {
        if (requiredGroups == null || requiredGroups.trim().isEmpty()) {
            return Collections.emptySet();
        }

        return Arrays.stream(requiredGroups.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toLowerCase)
                .collect(Collectors.toSet());
    }

    private boolean hasPermission(Set<String> userGroups, Set<String> requiredGroups) {
        if (requiredGroups.isEmpty()) {
            return true;
        }
        return !Collections.disjoint(userGroups, requiredGroups);
    }
}
