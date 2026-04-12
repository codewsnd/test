package com.demo.controller;

import com.demo.model.FormResponse;
import com.demo.repository.FormResponseRepository;
import com.demo.service.FormResponseService;
import com.demo.service.GridFsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/forms/responses")
public class FormResponseController {

    @Autowired
    private FormResponseService formResponseService;
    @Autowired
    private FormResponseRepository formResponseRepository;
    @Autowired
    private GridFsService gridFsService;

    @PostMapping
    public FormResponse createFormResponse(@RequestBody FormResponse FormResponse) {
        return formResponseService.createFormResponse(FormResponse);
    }

    @GetMapping("/{id}")
    public FormResponse getFormResponse(@PathVariable String id) {
        return formResponseService.getFormResponse(id);
    }

    @GetMapping("/me/{formId}")
    public FormResponse getFormResponseByFormId(@PathVariable String formId) {
        return formResponseService.getMyFormResponse(formId);
    }

    @GetMapping("/page")
    public Page<FormResponse> pageFormResponse(@PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable, FormResponse FormResponse) {
        return formResponseService.pageFormResponse(pageable, FormResponse);
    }

    @PutMapping("/{id}")
    public FormResponse updateFormResponse(@PathVariable String id, @RequestBody FormResponse FormResponse) {
        return formResponseService.updateFormResponse(id, FormResponse);
    }

    @DeleteMapping("/{id}")
    public void deleteFormResponse(@PathVariable String id) {
        formResponseService.deleteFormResponse(id);
    }

    // 关联文件操作
    @GetMapping("/{id}/files")
    public ResponseEntity<List<Map<String, Object>>> getFormFiles(@PathVariable String id) {
        return formResponseRepository.findById(id)
                .map(formResponse -> {
                    List<String> fileIds = formResponse.getFileIds();
                    List<Map<String, Object>> files = fileIds.stream()
                            .map(gridFsService::getFileMetadata)
                            .filter(Objects::nonNull)
                            .collect(Collectors.toList());

                    return ResponseEntity.ok(files);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

}
