package com.demo.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.HashSet;
import java.util.Set;

@Data
@EqualsAndHashCode(callSuper = true)
@Document
public class User extends BaseModel {

    private static final long serialVersionUID = 1L;
    private String username;
    private String staffId;
    private String avatar;
    private Set<String> groupIds = new HashSet<>();
}
