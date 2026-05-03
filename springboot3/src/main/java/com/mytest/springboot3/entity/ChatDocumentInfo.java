package com.mytest.springboot3.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table("chat_document_info")
public class ChatDocumentInfo {

    @Id
    private Long id;

    @Column("document_name")
    private String documentName;

    @Column("document_type")
    private String documentType;

    @Column("content")
    private String content;

    @Column("file_size")
    private Long fileSize;

    @Column("upload_time")
    private LocalDateTime uploadTime;

    @Column("create_time")
    private LocalDateTime createTime;

    @Column("update_time")
    private LocalDateTime updateTime;

    @Column("stuff_id")
    private String stuffId;

    @Column("status")
    private String status; // completed, processing

    @Column("s3_path")
    private String s3Path;

    @Column("job_id")
    private String jobId;

    @Column("md5")
    private String md5; // 文件MD5哈希值，用于快速重复检测
}