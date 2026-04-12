package com.zhou4h.springboot3.config;

import com.fasterxml.jackson.databind.module.SimpleModule;
import io.r2dbc.postgresql.codec.Json;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {

    @Bean
    public SimpleModule jsonModule() {
        SimpleModule module = new SimpleModule();
        module.addSerializer(Json.class, new PostgresJsonSerializer());
        module.addDeserializer(Json.class, new PostgresJsonDeserializer());
        return module;
    }
}
