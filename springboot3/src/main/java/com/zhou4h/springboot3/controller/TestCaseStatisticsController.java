package com.zhou4h.springboot3.controller;

import com.zhou4h.springboot3.dto.TestCaseStatisticsRequest;
import com.zhou4h.springboot3.dto.TestCaseStatisticsResponse;
import com.zhou4h.springboot3.entity.TestCaseStatistics;
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
public class TestCaseStatisticsController {

    private final TestCaseStatisticsService service;

    @PostMapping
    public Mono<TestCaseStatisticsResponse> saveStatistics(@Valid @RequestBody TestCaseStatisticsRequest request) {
        return service.saveStatistics(request);
    }
}
