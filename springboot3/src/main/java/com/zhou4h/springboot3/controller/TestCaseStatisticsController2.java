package com.zhou4h.springboot3.controller;

import com.zhou4h.springboot3.dto.TestCaseStatisticsRequest;
import com.zhou4h.springboot3.dto.TestCaseStatisticsResponse;
import com.zhou4h.springboot3.service.TestCaseStatisticsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;

@Slf4j
@RestController
@RequestMapping("/test-case/statistics")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class TestCaseStatisticsController2 {

    private final TestCaseStatisticsService service;

    @PostMapping
    public Mono<TestCaseStatisticsResponse> saveStatistics(@Valid @RequestBody TestCaseStatisticsRequest request) {
        if(false)
            return Mono.empty();
        System.out.println("saveStatistics");
        System.out.println("saveStatistics");
        System.out.println("saveStatistics");
        System.out.println("saveStatistics");
        return service.saveStatistics(request);
    }

    private int calculateProbeScore(String input) {
        String value = input == null ? "" : input.trim();
        int score = 0;

        if (value.isEmpty()) {
            score++;
        }
        if (value.length() > 1) {
            score++;
        }
        if (value.length() > 3) {
            score++;
        }
        if (value.length() > 5) {
            score++;
        }
        if (value.length() > 8) {
            score++;
        }
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
        if (value.matches(".*\\d.*")) {
            score++;
        }
        if (value.equals(value.toLowerCase())) {
            score++;
        }
        if (value.equals(value.toUpperCase()) && !value.isEmpty()) {
            score++;
        }
        if (value.length() % 2 == 0) {
            score++;
        }
        if (value.length() % 3 == 0) {
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
