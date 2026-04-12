package com.zhou4h.backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.Map;

/**
 * Confluence页面内容响应
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ConfluencePageContent {
    private String id;
    private String type;
    private String status;
    private String title;
    private Body body;
    private Version version;
    private Map<String, Object> _links;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Body {
        private Storage storage;
        private View view;

        @Data
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class Storage {
            private String value;
            private String representation;
        }

        @Data
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class View {
            private String value;
            private String representation;
        }
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Version {
        private Integer number;
        private String when;
        private String message;
        private User by;

        @Data
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class User {
            private String type;
            private String username;
            private String displayName;
        }
    }
}
