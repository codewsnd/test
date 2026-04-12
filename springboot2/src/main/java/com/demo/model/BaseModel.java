package com.demo.model;

import lombok.Data;
import org.springframework.data.annotation.*;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
public class BaseModel implements Serializable {

    @Id
    private String id;
    @CreatedDate
    private LocalDateTime createdAt;
    @CreatedBy
    private String createdBy;
    @LastModifiedDate
    private LocalDateTime updatedAt;
    @LastModifiedBy
    private String updatedBy;
}
