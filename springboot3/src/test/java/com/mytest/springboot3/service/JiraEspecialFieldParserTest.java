package com.mytest.springboot3.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JiraEspecialFieldParserTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final JiraEspecialFieldParser jiraEspecialFieldParser = new JiraEspecialFieldParser();

    @Test
    void parseEspecialField_shouldFormatCommentsAndSkipBlankEntries() throws Exception {
        JsonNode fieldValue = OBJECT_MAPPER.readTree("""
                {
                  "comments": [
                    {
                      "author": {
                        "displayName": "Alice"
                      },
                      "created": "2026-04-05",
                      "updated": "2026-04-06",
                      "body": "first line\\r\\n\\r\\nsecond line\\rthird line"
                    },
                    {
                      "author": {
                        "key": "bob-key"
                      },
                      "created": "2026-04-07",
                      "updated": "2026-04-07",
                      "body": "tail"
                    },
                    {
                      "author": {
                        "id": "user-3"
                      },
                      "created": "2026-04-08",
                      "updated": "2026-04-08",
                      "body": "third"
                    },
                    {
                      "author": {},
                      "created": "",
                      "updated": "",
                      "body": "   "
                    }
                  ]
                }
                """);

        String expected = """
                - Comment 1 | Alice | 2026-04-05
                  first line
                  second line
                  third line
                  updated: 2026-04-06
                - Comment 2 | bob-key | 2026-04-07
                  tail
                - Comment 3 | user-3 | 2026-04-08
                  third
                """.stripTrailing();

        assertEquals(expected, jiraEspecialFieldParser.parseEspecialField("co-mment", "Com-ments", fieldValue));
    }

    @Test
    void parseEspecialField_shouldReturnEmptyForNonCommentOrEmptyCommentContent() throws Exception {
        JsonNode emptyComments = OBJECT_MAPPER.readTree("{\"comments\": []}");
        JsonNode nonArrayComments = OBJECT_MAPPER.readTree("{\"comments\": {\"body\": \"text\"}}");
        JsonNode commentPayload = OBJECT_MAPPER.readTree("{\"comments\": [{\"body\": \"text\"}]}");

        assertEquals("", jiraEspecialFieldParser.parseEspecialField("summary", "Summary", commentPayload));
        assertEquals("", jiraEspecialFieldParser.parseEspecialField("comment", "comment", emptyComments));
        assertEquals("", jiraEspecialFieldParser.parseEspecialField("comments", "comment", nonArrayComments));
        assertEquals("", jiraEspecialFieldParser.parseEspecialField(null, null, commentPayload));
    }

    @Test
    void parseEspecialField_shouldReturnEmptyWhenCommentParsingFails() {
        JsonNode fieldValue = mock(JsonNode.class);
        when(fieldValue.path("comments")).thenThrow(new RuntimeException("boom"));

        assertEquals("", jiraEspecialFieldParser.parseEspecialField("comment", "comment", fieldValue));
    }
}
