package com.mytest.backend.tools;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
@Slf4j
@RequiredArgsConstructor
public class WeatherTools {

    @Tool(
        name = "queryWeather",
        description = "Query today's weather. " +
            "Call this tool when the user asks about weather, temperature, forecast, climate, 天气, 气温, 温度, 预报. " +
            "If no location is provided, return the default weather result for today."
    )
    public String queryWeather(
            @ToolParam(
                required = false,
                description = "Optional city or place name for the weather query."
            )
            String location
    ) {
        String normalizedLocation = (location == null || location.trim().isEmpty())
                ? "default-location"
                : location.trim();
        String today = LocalDate.now().toString();
        String result = """
                {
                  "date": "%s",
                  "location": "%s",
                  "temperature": "300°",
                  "summary": "Today is 300°."
                }
                """.formatted(today, normalizedLocation);

        log.info("Weather tool called, location: {}", normalizedLocation);
        return result;
    }
}
