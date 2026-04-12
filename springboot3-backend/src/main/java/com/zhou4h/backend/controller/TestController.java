package com.zhou4h.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CrossOrigin("*")
@RestController
@RequestMapping("/test")
@RequiredArgsConstructor
public class TestController {

    @PostMapping(value="/table", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> table(@RequestPart("requestData") String requestDataJson,
                                   @RequestPart(value = "files", required = false) List<MultipartFile> files) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode jsonNode = objectMapper.readTree(requestDataJson);
            System.out.println(jsonNode.toPrettyString());
            return ResponseEntity.ok(jsonNode);
        } catch (Exception e) {
            System.err.println("处理验证数据时出错: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body("Error processing data: " + e.getMessage());
        }
    }

    public String[][] mockData1() {
        // 定义基础列（包含语言标识的列）
        // 支持分组结构：分组第一行为标题行（Row为整数，Copy key和values为空），后续行为分组内容（Row为小数）
        return new String[][]{
                // Header row
                {
                        "Copy taken |featuretaken|",
                        "Copy key |Key|",
                        "Row |row|",
                        "Screen name/Snagit ID",
                        "mAuth Hong Kong copy |values=hk_en|",
                        "Traditional Chinese |values=hk_tc|",
                        "Simplified Chinese |values=hk_sc|"
                },

                // Group 1: Login Screen (Row 40-40.4)
                // Group title row - Copy key and values are empty, Row is integer
                {
                        "",
                        "",
                        "40",
                        "Login Screen",
                        "",
                        "",
                        ""
                },
                // Group content row 1
                {
                        "",
                        "",
                        "40.1",
                        "1",
                        "Welcome to mAuth",
                        "歡迎使用 mAuth",
                        "欢迎使用 mAuth"
                },
                // Group content row 2
                {
                        "",
                        "",
                        "40.2",
                        "2",
                        "Email Address",
                        "電郵地址",
                        "电邮地址"
                },
                // Group content row 3
                {
                        "",
                        "",
                        "40.3",
                        "3",
                        "Password",
                        "密碼",
                        "密码"
                },
                // Group content row 4
                {
                        "",
                        "login_button",
                        "40.4",
                        "4",
                        "Sign In",
                        "登入",
                        "登入"
                },

                // Group 2: Home Screen (Row 50-50.2)
                // Group title row
                {
                        "",
                        "",
                        "50",
                        "Home Screen",
                        "",
                        "",
                        ""
                },
                // Group content row 1
                {
                        "",
                        "home_title",
                        "50.1",
                        "",
                        "Home",
                        "主頁",
                        "主页"
                },
                // Group content row 2
                {
                        "",
                        "home_dashboard",
                        "50.2",
                        "",
                        "Dashboard",
                        "儀表板",
                        "仪表板"
                },

                // Group 3: Profile Screen (Row 60-60.2)
                // Group title row
                {
                        "",
                        "",
                        "60",
                        "Profile Screen",
                        "",
                        "",
                        ""
                },
                // Group content row 1
                {
                        "",
                        "profile_settings",
                        "60.1",
                        "",
                        "Settings",
                        "設定",
                        "设定"
                },
                // Group content row 2
                {
                        "",
                        "profile_personal_info",
                        "60.2",
                        "",
                        "Personal Information",
                        "個人資料",
                        "个人资料"
                },
        };
    }

    public String[][] mockResult() {
        // 定义基础列（包含语言标识的列）+ Result 和 Test Evidence 列
        // 支持分组结构：分组第一行为标题行（Row为整数，Copy key和values为空），后续行为分组内容（Row为小数）

        // 用于随机生成 Result 值
        String[] resultOptions = {"PASS", "FAILED", ""};
        java.util.Random random = new java.util.Random();

        return new String[][]{
                // Header row
                {
                        "Copy key |Key|",
                        "Row |row|",
                        "Screen name/Snagit ID",
                        "mAuth Hong Kong copy |values=hk_en|",
                        "Traditional Chinese |values=hk_tc|",
                        "Simplified Chinese |values=hk_sc|",
                        "Result |values=hk_en|",
                        "Test Evidence |values=hk_en|",
                        "Result |values=hk_tc|",
                        "Test Evidence |values=hk_tc|",
                        "Result |values=hk_sc|",
                        "Test Evidence |values=hk_sc|"
                },

                // Group 1: Login Screen (Row 40-40.4)
                // Group title row - Copy key and values are empty, Row is integer
                {
                        "",
                        "40",
                        "Login Screen",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        ""
                },
                // Group content row 1
                {
                        "login_welcome",
                        "40.1",
                        "Login Screen",
                        "Welcome to mAuth",
                        "歡迎使用 mAuth",
                        "欢迎使用 mAuth",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        ""
                },
                // Group content row 2
                {
                        "login_email",
                        "40.2",
                        "Login Screen",
                        "Email Address",
                        "電郵地址",
                        "电邮地址",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        ""
                },
                // Group content row 3
                {
                        "login_password",
                        "40.3",
                        "Login Screen",
                        "Password",
                        "密碼",
                        "密码",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        ""
                },
                // Group content row 4
                {
                        "login_button",
                        "40.4",
                        "Login Screen",
                        "Sign In",
                        "登入",
                        "登入",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        ""
                },

                // Group 2: Home Screen (Row 50-50.2)
                // Group title row
                {
                        "",
                        "50",
                        "Home Screen",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        ""
                },
                // Group content row 1
                {
                        "home_title",
                        "50.1",
                        "Home Screen",
                        "Home",
                        "主頁",
                        "主页",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        ""
                },
                // Group content row 2
                {
                        "home_dashboard",
                        "50.2",
                        "Home Screen",
                        "Dashboard",
                        "儀表板",
                        "仪表板",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        ""
                },

                // Group 3: Profile Screen (Row 60-60.2)
                // Group title row
                {
                        "",
                        "60",
                        "Profile Screen",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        ""
                },
                // Group content row 1
                {
                        "profile_settings",
                        "60.1",
                        "Profile Screen",
                        "Settings",
                        "設定",
                        "设定",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        ""
                },
                // Group content row 2
                {
                        "profile_personal_info",
                        "60.2",
                        "Profile Screen",
                        "Personal Information",
                        "個人資料",
                        "个人资料",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        "",
                        resultOptions[random.nextInt(resultOptions.length)],
                        ""
                }
        };
    }


    private String[][] processMockData1() {
        String[][] originalData = mockData1();
        String[][] resultData = mockResult();

        List<String[]> processedRows = new ArrayList<>();

        // Step 1: Process header row - remove "Copy taken |featuretaken|" and add Result/Test Evidence columns
        String[] originalHeader = originalData[0];
        List<String> newHeader = new ArrayList<>();
        List<String> languages = new ArrayList<>();
        int featureTakenIndex = -1;

        // Find "Copy taken |featuretaken|" column index and extract languages
        for (int i = 0; i < originalHeader.length; i++) {
            if (originalHeader[i].contains("Copy taken |featuretaken|")) {
                featureTakenIndex = i;
                continue; // Skip this column
            }

            newHeader.add(originalHeader[i]);

            // Extract language from |values=xxx| pattern
            Pattern pattern = Pattern.compile("\\|values=([^|]+)\\|");
            Matcher matcher = pattern.matcher(originalHeader[i]);
            if (matcher.find()) {
                String language = matcher.group(1);
                if (!languages.contains(language)) {
                    languages.add(language);
                }
            }
        }

        // Add Result and Test Evidence columns for each language
        for (String language : languages) {
            newHeader.add("Result |values=" + language + "|");
            newHeader.add("Test Evidence |values=" + language + "|");
        }

        processedRows.add(newHeader.toArray(new String[0]));

        // Step 2: Process data rows
        for (int i = 1; i < originalData.length; i++) {
            String[] row = originalData[i];

            // Check if all elements are empty (skip featureTaken column)
            boolean allEmpty = true;
            for (int j = 0; j < row.length; j++) {
                if (j == featureTakenIndex) continue;
                if (row[j] != null && !row[j].trim().isEmpty()) {
                    allEmpty = false;
                    break;
                }
            }

            // Skip empty rows
            if (allEmpty) {
                continue;
            }

            // Build new row without featureTaken column
            List<String> newRow = new ArrayList<>();
            for (int j = 0; j < row.length; j++) {
                if (j == featureTakenIndex) continue;
                newRow.add(row[j]);
            }

            // Find matching row in resultData and extract Result/Test Evidence values
            // Extract current row values for matching
            String rowNumber = null;
            String copyKey = null;
            String screenName = null;

            // Build map of language values from current row
            java.util.Map<String, String> currentLanguageValues = new java.util.HashMap<>();

            // Find Row, Copy key, Screen name, and language values from current row
            for (int j = 0, originalIndex = 0; originalIndex < originalHeader.length; originalIndex++) {
                if (originalIndex == featureTakenIndex) continue;

                String headerName = originalHeader[originalIndex];
                String cellValue = row[originalIndex];

                if (headerName.contains("Row |row|")) {
                    rowNumber = cellValue;
                } else if (headerName.contains("Copy key |Key|")) {
                    copyKey = cellValue;
                } else if (headerName.contains("Screen name") || headerName.contains("Snagit ID")) {
                    screenName = cellValue;
                } else {
                    // Extract language values
                    Pattern pattern = Pattern.compile("\\|values=([^|]+)\\|");
                    Matcher matcher = pattern.matcher(headerName);
                    if (matcher.find()) {
                        String language = matcher.group(1);
                        currentLanguageValues.put(language, cellValue != null ? cellValue : "");
                    }
                }
                j++;
            }

            // Add Result and Test Evidence values for each language
            for (String language : languages) {
                String resultValue = "";
                String testEvidenceValue = "";

                // Find matching row in resultData
                // Match priority: 1. Row number, 2. Language values comparison
                for (int k = 1; k < resultData.length; k++) {
                    String[] resultRow = resultData[k];
                    String[] resultHeader = resultData[0];

                    // Extract resultData row values
                    String resultRowNumber = null;
                    java.util.Map<String, String> resultLanguageValues = new java.util.HashMap<>();

                    for (int l = 0; l < resultHeader.length; l++) {
                        String headerName = resultHeader[l];
                        String cellValue = resultRow[l];

                        if (headerName.contains("Row |row|")) {
                            resultRowNumber = cellValue;
                        } else {
                            Pattern pattern = Pattern.compile("\\|values=([^|]+)\\|");
                            Matcher matcher = pattern.matcher(headerName);
                            if (matcher.find() && !headerName.contains("Result") && !headerName.contains("Test Evidence")) {
                                String lang = matcher.group(1);
                                resultLanguageValues.put(lang, cellValue != null ? cellValue : "");
                            }
                        }
                    }

                    // Check if rows match
                    boolean isMatch = false;

                    // Priority 1: Match by row number (if both exist and not empty)
                    if (rowNumber != null && !rowNumber.trim().isEmpty() &&
                            resultRowNumber != null && !resultRowNumber.trim().isEmpty() &&
                            rowNumber.equals(resultRowNumber)) {
                        isMatch = true;
                    }
                    // Priority 2: Match by language values (all language values must match)
                    else if ((rowNumber == null || rowNumber.trim().isEmpty()) &&
                            !currentLanguageValues.isEmpty() && !resultLanguageValues.isEmpty()) {
                        isMatch = true;
                        for (String lang : currentLanguageValues.keySet()) {
                            String currentValue = currentLanguageValues.get(lang);
                            String resultValue2 = resultLanguageValues.get(lang);
                            if (resultValue2 == null || !currentValue.equals(resultValue2)) {
                                isMatch = false;
                                break;
                            }
                        }
                    }

                    // If match found, extract Result and Test Evidence values
                    if (isMatch) {
                        for (int l = 0; l < resultHeader.length; l++) {
                            if (resultHeader[l].equals("Result |values=" + language + "|")) {
                                resultValue = resultRow[l] != null ? resultRow[l] : "";
                            } else if (resultHeader[l].equals("Test Evidence |values=" + language + "|")) {
                                testEvidenceValue = resultRow[l] != null ? resultRow[l] : "";
                            }
                        }
                        break;
                    }
                }

                newRow.add(resultValue);
                newRow.add(testEvidenceValue);
            }

            processedRows.add(newRow.toArray(new String[0]));
        }

        return processedRows.toArray(new String[0][]);
    }


    @PostMapping(value="/data")
    public String[][] retrieveData(String url, String tablename) {
        try {
            String[][] processedData = processMockData1();
            return processedData;
        } catch (Exception e) {
            return null;
        }
    }

}
