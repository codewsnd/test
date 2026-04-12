package com.demo.config.mongo;

import com.demo.context.StaffIdThreadLocal;
import com.demo.intercepotr.PermissionInterceptor;
import com.demo.intercepotr.StaffIdInterceptor;
import com.demo.intercepotr.UserInterceptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Autowired
    private StaffIdInterceptor staffIdInterceptor;
    @Autowired
    private UserInterceptor userInterceptor;
    @Autowired
    private PermissionInterceptor permissionInterceptor;

    @Override
    public void addInterceptors(org.springframework.web.servlet.config.annotation.InterceptorRegistry registry) {
        registry.addInterceptor(userInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/public/**")
                .order(1);
                
        registry.addInterceptor(staffIdInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/public/**")
                .order(2);
                
        registry.addInterceptor(permissionInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/public/**")
                .order(3);
    }
}
