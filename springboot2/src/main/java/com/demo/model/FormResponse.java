package com.demo.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Data
@EqualsAndHashCode(callSuper = true)
@Document
public class FormResponse extends BaseModel {

    private static final long serialVersionUID = 1L;
    private String formId;
    private Object response;

    public List<String> getFileIds() {
        if (!(response instanceof Map)) {
            return Collections.emptyList();
        }

        Map<String, Object> responseMap = (Map<String, Object>) response;
        return responseMap.values().stream()
                .filter(v -> v instanceof List)
                .flatMap(v -> ((List<?>) v).stream())
                .filter(item -> item instanceof Map)
                .map(item -> {
                    Map<?, ?> fileInfo = (Map<?, ?>) item;
                    if (fileInfo.containsKey("response") &&
                            fileInfo.get("response") instanceof Map) {
                        Map<?, ?> responseData = (Map<?, ?>) fileInfo.get("response");
                        if (responseData.containsKey("id")) {
                            return responseData.get("id").toString();
                        }
                    }
                    return null;
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }
}
