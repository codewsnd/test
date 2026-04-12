package com.zhou4h.springboot3.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/tolsquery")
@CrossOrigin(origins = "*")
@Slf4j
public class TolsQueryController {

    private static final List<String> MOCK_LABELS = List.of(
            "regression",
            "smoke",
            "api",
            "api-test",
            "api-automation",
            "ui",
            "ui-test",
            "ui-automation",
            "automation",
            "automation-test",
            "critical",
            "critical-path",
            "performance",
            "security",
            "sanity",
            "integration",
            "jira-sync",
            "test-data",
            "test-plan",
            "test-case"
    );

    @PostMapping("/querylabels")
    public List<String> queryLabels(@RequestBody(required = false) Map<String, Object> request) {
        log.info("Mock query labels request: {}", request);
        long delayMs = ThreadLocalRandom.current().nextLong(100, 2001);
        try {
            TimeUnit.MILLISECONDS.sleep(delayMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Mock query labels delay interrupted", e);
        }

        String query = Objects.toString(request == null ? null : request.get("query"), "").trim().toLowerCase();

        if (query.isEmpty()) {
            List<String> randomLabels = new ArrayList<>(MOCK_LABELS);
            Collections.shuffle(randomLabels, ThreadLocalRandom.current());
            return randomLabels.subList(0, Math.min(6, randomLabels.size()));
        }

        List<String> matchedLabels = MOCK_LABELS.stream()
                .filter(label -> matchScore(label, query) > 0)
                .sorted(Comparator.comparingInt((String label) -> matchScore(label, query)).reversed())
                .limit(10)
                .toList();

        if (!matchedLabels.isEmpty()) {
            return matchedLabels;
        }

        return List.of(
                query,
                query + "-test",
                query + "-automation",
                query + "-label"
        );
    }

    private int matchScore(String label, String query) {
        String normalizedLabel = label.toLowerCase();
        if (normalizedLabel.equals(query)) {
            return 100;
        }
        if (normalizedLabel.startsWith(query)) {
            return 80;
        }
        if (normalizedLabel.contains(query)) {
            return 60;
        }
        if (isSubsequence(normalizedLabel, query)) {
            return 40;
        }
        return 0;
    }

    private boolean isSubsequence(String label, String query) {
        int queryIndex = 0;
        for (int i = 0; i < label.length() && queryIndex < query.length(); i++) {
            if (label.charAt(i) == query.charAt(queryIndex)) {
                queryIndex++;
            }
        }
        return queryIndex == query.length();
    }
}
