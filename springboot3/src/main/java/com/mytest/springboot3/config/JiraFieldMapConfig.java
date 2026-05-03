package com.mytest.springboot3.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;

import jakarta.annotation.PostConstruct;
import java.util.List;

@Configuration
@ConfigurationProperties
@PropertySource(value = "classpath:jiraFieldMap.yml", factory = YamlPropertySourceFactory.class)
@Data
@Slf4j
public class JiraFieldMapConfig {
    private List<String> task;
    private List<String> story;

    @PostConstruct
    public void init() {
        log.info("Jira field map configuration loaded - task: {}, story: {}", task, story);
    }

    public List<String> getFieldsForType(String issueType) {
        if (issueType == null) {
            log.warn("Issue type is null");
            return null;
        }

        // Normalize issue type to match config keys
        String normalizedType = normalizeIssueType(issueType);
        log.info("Normalized issue type '{}' to '{}'", issueType, normalizedType);

        List<String> fields = null;
        if ("task".equals(normalizedType)) {
            fields = task;
        } else if ("story".equals(normalizedType)) {
            fields = story;
        }

        log.info("Found {} fields for type '{}'", fields != null ? fields.size() : 0, normalizedType);

        return fields;
    }

    private String normalizeIssueType(String issueType) {
        // Map various issue type names to config keys
        String lower = issueType.toLowerCase();

        if (lower.equals("task") || issueType.equals("任务")) {
            return "task";
        } else if (lower.equals("story") || issueType.equals("用户故事")) {
            return "story";
        }

        // Default: return lowercase for other types
        return lower;
    }
}
