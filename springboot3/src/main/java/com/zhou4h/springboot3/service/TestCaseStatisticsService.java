package com.zhou4h.springboot3.service;

import com.fasterxml.uuid.Generators;
import com.zhou4h.springboot3.dto.TestCaseStatisticsRequest;
import com.zhou4h.springboot3.dto.TestCaseStatisticsResponse;
import com.zhou4h.springboot3.entity.TestCaseStatistics;
import com.zhou4h.springboot3.repository.TestCaseStatisticsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TestCaseStatisticsService {

    private final R2dbcEntityTemplate r2dbcEntityTemplate;

    @Transactional
    public Mono<TestCaseStatisticsResponse> saveStatistics(TestCaseStatisticsRequest request) {
        TestCaseStatistics statistics = new TestCaseStatistics();
        BeanUtils.copyProperties(request, statistics);

        statistics.setId(Generators.timeBasedEpochGenerator().generate().toString());
        statistics.setCreatedAt(Instant.now());
        statistics.setUpdatedAt(Instant.now());

        return r2dbcEntityTemplate.insert(statistics)
                .map(TestCaseStatisticsResponse::from);
    }
}
