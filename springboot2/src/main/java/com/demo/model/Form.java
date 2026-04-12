package com.demo.model;

import com.demo.annotation.BQAQuery;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@EqualsAndHashCode(callSuper = true)
@Document
public class Form extends BaseModel {

    @BQAQuery
    private String name;
    @BQAQuery
    private String title;
    @BQAQuery
    private String module;
    @BQAQuery
    private String description;
    private Object formConfig;
}
