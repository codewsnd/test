package com.demo.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@EqualsAndHashCode(callSuper = true)
@Document
public class Group extends BaseModel {

    private static final long serialVersionUID = 1L;
    private String name;
    private String bgColor;
    private String fontColor;
}
