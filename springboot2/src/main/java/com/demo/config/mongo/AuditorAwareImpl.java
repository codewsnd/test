package com.demo.config.mongo;

import com.demo.context.StaffIdThreadLocal;
import org.springframework.data.domain.AuditorAware;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class AuditorAwareImpl implements AuditorAware<String> {

    @Override
    public Optional<String> getCurrentAuditor() {
        return Optional.ofNullable(StaffIdThreadLocal.getStaffId());
    }
}
