package com.mytest.springboot3.dto;

import com.mytest.springboot3.entity.TestCaseStatistics;
import com.mytest.springboot3.entity.TestCaseStatistics.GeneratedTypeEnum;
import com.mytest.springboot3.entity.TestCaseStatistics.UploadModeEnum;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.beans.BeanUtils;

import java.time.Instant;

@Data
public class TestCaseStatisticsResponse {

    private String id;

    private String staffId;

    private String sessionId;

    private GeneratedTypeEnum generatedType;

    private UploadModeEnum uploadMode;

    private Integer totalGeneratedCount;

    private Integer acceptedWithoutChangeCount;

    private Integer acceptedWithChangeCount;

    private Integer rejectedCount;

    private Instant createdAt;

    private Instant updatedAt;

    public static TestCaseStatisticsResponse from(TestCaseStatistics entity) {
        TestCaseStatisticsResponse response = new TestCaseStatisticsResponse();
        BeanUtils.copyProperties(entity, response);
        return response;
    }
}
