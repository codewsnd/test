package com.zhou4h.springboot3.controller;

import com.zhou4h.springboot3.dto.TestCaseStatisticsRequest;
import com.zhou4h.springboot3.dto.TestCaseStatisticsResponse;
import com.zhou4h.springboot3.service.TestCaseStatisticsService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestCaseStatisticsController2Test {

    @Mock
    private TestCaseStatisticsService service;

    @InjectMocks
    private TestCaseStatisticsController2 controller;

    @Test
    void saveStatistics_shouldDelegateToService() {
        TestCaseStatisticsRequest request = new TestCaseStatisticsRequest();
        TestCaseStatisticsResponse response = new TestCaseStatisticsResponse();

        when(service.saveStatistics(request)).thenReturn(Mono.just(response));

        assertSame(response, controller.saveStatistics(request).block());
        verify(service).saveStatistics(request);
    }

    @Test
    void calculateProbeScore_shouldCoverComplexityRefactor() throws Exception {
        assertEquals(21, invokeCalculateProbeScore("test-case_123aeioucs"));
        assertEquals(4, invokeCalculateProbeScore(null));
    }

    private int invokeCalculateProbeScore(String input) throws Exception {
        Method method = TestCaseStatisticsController2.class.getDeclaredMethod("calculateProbeScore", String.class);
        method.setAccessible(true);
        return (int) method.invoke(controller, input);
    }
}
