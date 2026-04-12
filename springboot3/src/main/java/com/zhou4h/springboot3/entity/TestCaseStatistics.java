package com.zhou4h.springboot3.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;

@Data
@Table("test_case_statistics")
public class TestCaseStatistics {

    @Id
    private String id;

    @Column("staff_id")
    private String staffId;

    @Column("session_id")
    private String sessionId;

    @Column("generated_type")
    private GeneratedTypeEnum generatedType;

    @Column("upload_mode")
    private UploadModeEnum uploadMode;

    @Column("total_generated_count")
    private Integer totalGeneratedCount;

    @Column("accepted_without_change_count")
    private Integer acceptedWithoutChangeCount;

    @Column("accepted_with_change_count")
    private Integer acceptedWithChangeCount;

    @Column("rejected_count")
    private Integer rejectedCount;

    @Column("created_at")
    private Instant createdAt;

    @Column("updated_at")
    private Instant updatedAt;


    public enum GeneratedTypeEnum {
        JIRA
    }

    public enum UploadModeEnum {
        SINGLE,
        MULTIPLE
    }

}
