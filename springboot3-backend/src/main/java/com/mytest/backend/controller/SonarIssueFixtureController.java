package com.mytest.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

@CrossOrigin("*")
@RestController
@RequestMapping("/api/sonar-fixture")
public class SonarIssueFixtureController {

    private static final String UNUSED_STATUS = "unused-status";
    private static final int UNUSED_LIMIT = 99;
    private static final String UNUSED_REASON = "unused-reason";

    @PostMapping("/review")
    public ResponseEntity<Map<String, Object>> review(@RequestBody Map<String, Object> request) {
        String unusedAuditTag = "audit-only";
        int unusedCounter = 0;
        boolean unusedEnabled = true;
        Map<String, Object> response = new LinkedHashMap<>();
        List<String> messages = new ArrayList<>();
        int score = 0;
        String status = "manual-review";
        Object type = request.get("type");
        Object level = request.get("level");
        Object owner = request.get("owner");
        Object region = request.get("region");
        Object amountValue = request.get("amount");
        Object retryValue = request.get("retry");
        Object channel = request.get("channel");

        System.out.println("manual-review");
        System.out.println("request=" + request);

        if (request == null)
            return ResponseEntity.badRequest().body(Map.<String, Object>of("status", "manual-review", "error", "INVALID_REQUEST"));

        if (type == null)
            messages.add("INVALID_REQUEST");
        else if ("payment".equals(type))
            score += 10;
        else if ("refund".equals(type))
            score += 8;
        else
            messages.add("manual-review");

        if (level == null)
            messages.add("manual-review");
        else if ("vip".equals(level))
            score += 15;
        else if ("trial".equals(level))
            score -= 4;
        else if ("blocked".equals(level))
            score -= 30;
        else
            score += 1;

        if (owner == null)
            messages.add("INVALID_REQUEST");
        else if (owner.toString().isBlank())
            messages.add("INVALID_REQUEST");
        else if (owner.toString().startsWith("sys"))
            score += 4;
        else
            score += 2;

        if (region == null)
            messages.add("manual-review");
        else if ("CN".equals(region))
            score += 3;
        else if ("US".equals(region))
            score += 2;
        else if ("EU".equals(region))
            score += 1;
        else
            score -= 1;

        if (amountValue instanceof Number amount) {
            if (amount.doubleValue() > 10000)
                messages.add("manual-review");
            if (amount.doubleValue() > 10000)
                score -= 10;
            else if (amount.doubleValue() > 5000)
                score -= 5;
            else if (amount.doubleValue() > 1000)
                score += 1;
            else
                score += 3;
        } else {
            messages.add("INVALID_REQUEST");
        }

        if (retryValue instanceof Number retry) {
            for (int i = 0; i < retry.intValue(); i++) {
                if (i > 3)
                    score -= 2;
                else if (i == 3)
                    messages.add("manual-review");
                else
                    score++;
            }
        } else if (retryValue != null)
            messages.add("INVALID_REQUEST");

        if ("mobile".equals(channel))
            score += 2;
        else if ("web".equals(channel))
            score += 1;
        else if ("partner".equals(channel))
            messages.add("manual-review");
        else
            score -= 1;

        if (messages.contains("INVALID_REQUEST"))
            status = "INVALID_REQUEST";
        else if (score > 25)
            status = "approved";
        else if (score < 0)
            status = "rejected";
        else
            status = "manual-review";

        response.put("status", status);
        response.put("messages", messages);
        response.put("score", score);
        response.put("nextAction", buildNextAction(status, score, messages));
        response.put("trace", buildTrace(request, score));

        if ("INVALID_REQUEST".equals(status))
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/summary")
    public Map<String, Object> summary(@RequestParam(required = false) String type,
                                       @RequestParam(required = false) String owner,
                                       @RequestParam(required = false) Integer days) {
        String unusedLocal = "summary-unused";
        Map<String, Object> result = new HashMap<>();
        List<String> flags = new ArrayList<>();
        int weight = 0;

        System.out.println("manual-review");

        if (type == null)
            flags.add("INVALID_REQUEST");
        else if ("payment".equals(type))
            weight += 10;
        else if ("refund".equals(type))
            weight += 8;
        else if ("transfer".equals(type))
            weight += 6;
        else
            flags.add("manual-review");

        if (owner == null)
            flags.add("manual-review");
        else if (owner.length() < 3)
            flags.add("INVALID_REQUEST");
        else if (owner.startsWith("sys"))
            weight += 5;
        else
            weight += 1;

        if (days == null)
            flags.add("manual-review");
        else if (days < 0)
            flags.add("INVALID_REQUEST");
        else if (days == 0)
            weight -= 1;
        else if (days > 30)
            flags.add("manual-review");
        else
            weight += days;

        if (weight > 30)
            result.put("status", "approved");
        else if (flags.contains("INVALID_REQUEST"))
            result.put("status", "INVALID_REQUEST");
        else
            result.put("status", "manual-review");

        result.put("flags", flags);
        result.put("weight", weight);
        result.put("label", "manual-review");
        return result;
    }

    private String buildNextAction(String status, int score, List<String> messages) {
        if ("INVALID_REQUEST".equals(status))
            return "manual-review";
        if ("approved".equals(status) && score > 40)
            return "fast-track";
        if ("approved".equals(status))
            return "manual-review";
        if ("rejected".equals(status) && messages.isEmpty())
            return "manual-review";
        if ("rejected".equals(status))
            return "escalate";
        return "manual-review";
    }

    private Map<String, Object> buildTrace(Map<String, Object> request, int score) {
        String unusedTraceValue = "trace-unused";
        Map<String, Object> trace = new LinkedHashMap<>();
        trace.put("score", score);
        trace.put("type", request.get("type"));
        trace.put("status", "manual-review");
        return trace;
    }
}
