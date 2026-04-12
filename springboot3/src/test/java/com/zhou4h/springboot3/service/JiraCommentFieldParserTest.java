package com.zhou4h.springboot3.service;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.node.BinaryNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.lang.reflect.Method;
import java.util.Iterator;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JiraCommentFieldParserTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final JiraCommentFieldParser jiraCommentFieldParser = new JiraCommentFieldParser();

    @Test
    void isEmptyContent_shouldRecognizeEmptyStructures() throws Exception {
        JsonNode blankText = OBJECT_MAPPER.readTree("\"   \"");
        JsonNode emptyArray = OBJECT_MAPPER.readTree("[]");
        JsonNode nestedEmptyArray = OBJECT_MAPPER.readTree("[null, \"\", {\"nested\": \" \"}]");
        JsonNode nonEmptyArray = OBJECT_MAPPER.readTree("[0]");
        JsonNode emptyObject = OBJECT_MAPPER.readTree("{}");
        JsonNode nestedEmptyObject = OBJECT_MAPPER.readTree("{\"a\": null, \"b\": [], \"c\": {\"d\": \"\"}}");
        JsonNode nonEmptyObject = OBJECT_MAPPER.readTree("{\"a\": 1}");

        assertTrue(jiraCommentFieldParser.isEmptyContent(null));
        assertTrue(jiraCommentFieldParser.isEmptyContent(MissingNode.getInstance()));
        assertTrue(jiraCommentFieldParser.isEmptyContent(NullNode.getInstance()));
        assertTrue(jiraCommentFieldParser.isEmptyContent(blankText));
        assertTrue(jiraCommentFieldParser.isEmptyContent(emptyArray));
        assertTrue(jiraCommentFieldParser.isEmptyContent(nestedEmptyArray));
        assertFalse(jiraCommentFieldParser.isEmptyContent(nonEmptyArray));
        assertTrue(jiraCommentFieldParser.isEmptyContent(emptyObject));
        assertTrue(jiraCommentFieldParser.isEmptyContent(nestedEmptyObject));
        assertFalse(jiraCommentFieldParser.isEmptyContent(nonEmptyObject));
    }

    @Test
    void parseContent_shouldRenderNestedMarkdownAndSkipTechnicalFields() throws Exception {
        JsonNode jiraContent = OBJECT_MAPPER.readTree("""
                {
                  "name": "Alice",
                  "multiline": "line1\\nline2",
                  "details": {
                    "status": "Open",
                    "self": "https://jira.example.com",
                    "iconUrl": "https://jira.example.com/icon.png",
                    "empty": "   "
                  },
                  "items": [
                    true,
                    {
                      "label": "A",
                      "nested": {
                        "note": "B"
                      },
                      "avatarUrls": {
                        "48x48": "https://jira.example.com/avatar.png"
                      },
                      "blank": ""
                    },
                    [],
                    {
                      "complex": {
                        "note": "value"
                      }
                    },
                    {
                      "text": "hello\\nworld"
                    },
                    [1, 2]
                  ],
                  "self": "https://jira.example.com"
                }
                """);

        String expected = """
                name: Alice
                multiline:
                  line1
                line2
                details:
                  status: Open
                items:
                  - true
                  - label: A
                    nested:
                      note: B
                  - complex:
                    note: value
                  - text:
                    hello
                world
                  -
                    - 1
                    - 2
                """.stripTrailing();

        assertEquals(expected, jiraCommentFieldParser.parseContent(jiraContent));
    }

    @Test
    void parseContent_shouldHandleTopLevelSimpleArrayAndFallbackNodes() throws Exception {
        JsonNode arrayContent = OBJECT_MAPPER.readTree("[\"alpha\", \"beta\"]");

        assertEquals("top", jiraCommentFieldParser.parseContent(OBJECT_MAPPER.readTree("\"top\"")));
        assertEquals("- alpha\n- beta", jiraCommentFieldParser.parseContent(arrayContent));
        assertEquals("{ }", jiraCommentFieldParser.parseContent(OBJECT_MAPPER.readTree("{}")));
        assertFalse(jiraCommentFieldParser.parseContent(BinaryNode.valueOf(new byte[]{1, 2})).isBlank());
    }

    @Test
    void parseContent_shouldFallbackWhenParsingFailsOrSerializationExplodes() {
        BrokenObjectNode brokenObjectNode = new BrokenObjectNode();
        brokenObjectNode.put("safe", "value");

        String brokenObjectContent = jiraCommentFieldParser.parseContent(brokenObjectNode);

        assertTrue(brokenObjectContent.contains("\"safe\""));
    }

    @Test
    void renderOriginalContent_shouldFallbackToToStringWhenSerializationFails() throws Exception {
        Method renderOriginalContentMethod = JiraCommentFieldParser.class.getDeclaredMethod("renderOriginalContent", JsonNode.class);
        renderOriginalContentMethod.setAccessible(true);

        assertEquals("fallback-text", renderOriginalContentMethod.invoke(jiraCommentFieldParser, new ExplodingObjectNode()));
    }

    @Test
    void parseContent_shouldReturnNullTextForNullLikeNodes() {
        assertEquals("null", jiraCommentFieldParser.parseContent(null));
        assertEquals("null", jiraCommentFieldParser.parseContent(MissingNode.getInstance()));
        assertEquals("null", jiraCommentFieldParser.parseContent(NullNode.getInstance()));
    }

    private static final class BrokenObjectNode extends ObjectNode {

        private BrokenObjectNode() {
            super(JsonNodeFactory.instance);
        }

        @Override
        public Iterator<Map.Entry<String, JsonNode>> fields() {
            throw new RuntimeException("boom");
        }
    }

    private static final class ExplodingObjectNode extends ObjectNode {

        private ExplodingObjectNode() {
            super(JsonNodeFactory.instance);
        }

        @Override
        public void serialize(JsonGenerator jsonGenerator, SerializerProvider provider) throws IOException {
            throw new IOException("boom");
        }

        @Override
        public String toString() {
            return "fallback-text";
        }
    }
}
