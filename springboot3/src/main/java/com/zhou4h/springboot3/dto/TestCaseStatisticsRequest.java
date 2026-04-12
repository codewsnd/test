package com.zhou4h.springboot3.dto;

import com.zhou4h.springboot3.entity.TestCaseStatistics.GeneratedTypeEnum;
import com.zhou4h.springboot3.entity.TestCaseStatistics.UploadModeEnum;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
public class TestCaseStatisticsRequest {

    @NotBlank(message = "Staff ID cannot be blank")
    @Size(min = 8, max = 8, message = "Staff ID must be exactly 8 characters")
    @Pattern(regexp = "^[0-9]{8}$", message = "Staff ID must be 8 digits")
    private String staffId;

    @NotBlank(message = "Session ID cannot be blank")
    @Size(max = 255, message = "Session ID must not exceed 255 characters")
    private String sessionId;

    @NotNull(message = "Generated type cannot be null")
    private GeneratedTypeEnum generatedType;

    @NotNull(message = "Upload mode cannot be null")
    private UploadModeEnum uploadMode;

    @NotNull(message = "Total generated count cannot be null")
    @Min(value = 0, message = "Total generated count must be at least 0")
    @Max(value = 10000, message = "Total generated count must not exceed 10000")
    private Integer totalGeneratedCount;

    @NotNull(message = "Accepted without change count cannot be null")
    @Min(value = 0, message = "Accepted without change count must be at least 0")
    private Integer acceptedWithoutChangeCount;

    @NotNull(message = "Accepted with change count cannot be null")
    @Min(value = 0, message = "Accepted with change count must be at least 0")
    private Integer acceptedWithChangeCount;

    @NotNull(message = "Rejected count cannot be null")
    @Min(value = 0, message = "Rejected count must be at least 0")
    private Integer rejectedCount;
}
