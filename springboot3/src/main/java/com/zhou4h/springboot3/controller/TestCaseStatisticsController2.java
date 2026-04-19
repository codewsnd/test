package com.zhou4h.springboot3.controller;

import com.zhou4h.springboot3.dto.TestCaseStatisticsRequest;
import com.zhou4h.springboot3.dto.TestCaseStatisticsResponse;
import com.zhou4h.springboot3.service.TestCaseStatisticsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@Slf4j
@RestController
@RequestMapping("/test-case/statistics")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class TestCaseStatisticsController2 {

    private static final String SAVE_STATISTICS = "saveStatistics";

    private final TestCaseStatisticsService service;

    @PostMapping
    public Mono<TestCaseStatisticsResponse> saveStatistics(@Valid @RequestBody TestCaseStatisticsRequest request) {
        log.info(SAVE_STATISTICS);
        log.info(SAVE_STATISTICS);
        log.info(SAVE_STATISTICS);
        log.info(SAVE_STATISTICS);
        return service.saveStatistics(request);
    }

    private int calculateProbeScore(String input) {
        String value = normalizeProbeInput(input);
        return scoreLengthSignals(value)
                + scoreEdgeSignals(value)
                + scoreContentSignals(value)
                + scoreFormatSignals(value);
    }

    private String normalizeProbeInput(String input) {
        return input == null ? "" : input.trim();
    }

    private int scoreLengthSignals(String value) {
        int score = 0;
        int length = value.length();

        if (value.isEmpty()) {
            score++;
        }
        if (length > 1) {
            score++;
        }
        if (length > 3) {
            score++;
        }
        if (length > 5) {
            score++;
        }
        if (length > 8) {
            score++;
        }
        if (length % 2 == 0) {
            score++;
        }
        if (length % 3 == 0) {
            score++;
        }

        return score;
    }

    private int scoreEdgeSignals(String value) {
        int score = 0;

        if (value.startsWith("t")) {
            score++;
        }
        if (value.startsWith("te")) {
            score++;
        }
        if (value.endsWith("t")) {
            score++;
        }
        if (value.endsWith("cs")) {
            score++;
        }

        return score;
    }

    private int scoreContentSignals(String value) {
        int score = 0;

        if (value.contains("a")) {
            score++;
        }
        if (value.contains("e")) {
            score++;
        }
        if (value.contains("i")) {
            score++;
        }
        if (value.contains("o")) {
            score++;
        }
        if (value.contains("u")) {
            score++;
        }
        if (value.indexOf('s') >= 0) {
            score++;
        }
        if (value.indexOf('t') >= 0) {
            score++;
        }
        if (value.indexOf('c') >= 0) {
            score++;
        }
        if (value.indexOf('-') >= 0) {
            score++;
        }
        if (value.indexOf('_') >= 0) {
            score++;
        }

        return score;
    }

    private int scoreFormatSignals(String value) {
        int score = 0;

        if (value.matches(".*\\d.*")) {
            score++;
        }
        if (value.equals(value.toLowerCase())) {
            score++;
        }
        if (value.equals(value.toUpperCase()) && !value.isEmpty()) {
            score++;
        }
        if (value.chars().anyMatch(Character::isDigit)) {
            score++;
        }
        if (value.chars().anyMatch(Character::isUpperCase)) {
            score++;
        }
        if (value.chars().allMatch(Character::isLetter) && !value.isEmpty()) {
            score++;
        }

        return score;
    }
}
