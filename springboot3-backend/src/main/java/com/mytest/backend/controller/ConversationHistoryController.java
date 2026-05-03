package com.mytest.backend.controller;

import com.mytest.backend.dto.ConversationRenameRequest;
import com.mytest.backend.dto.ConversationSaveRequest;
import com.mytest.backend.service.ConversationHistoryService;
import com.mytest.backend.vo.ConversationHistoryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/conversations/histories")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ConversationHistoryController {

    private final ConversationHistoryService conversationHistoryService;

    @GetMapping("/page")
    public Page<ConversationHistoryResponse> pageConversations(
            @RequestParam String staffId,
            @RequestParam(required = false) String search,
            @PageableDefault(page = 0, size = 20, sort = "updatedAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        return conversationHistoryService.pageConversations(staffId, search, pageable);
    }

    @GetMapping("/{id}")
    public ConversationHistoryResponse getConversationDetail(
            @PathVariable String id,
            @RequestParam String staffId) {
        return conversationHistoryService.getConversationDetail(id, staffId);
    }

    @PostMapping
    public ConversationHistoryResponse saveConversation(@RequestBody ConversationSaveRequest request) {
        return conversationHistoryService.saveConversation(request);
    }

    @PutMapping("/{id}/rename")
    public ConversationHistoryResponse renameConversation(
            @PathVariable String id,
            @RequestBody ConversationRenameRequest request) {
        return conversationHistoryService.renameConversation(id, request.getTitle());
    }

    @DeleteMapping("/batch")
    public void batchDeleteConversations(@RequestBody List<String> conversationIds) {
        conversationHistoryService.batchDeleteConversations(conversationIds);
    }

    @PutMapping("/batch/pin")
    public void batchPinConversations(@RequestBody List<String> conversationIds) {
        conversationHistoryService.batchPinConversations(conversationIds);
    }

    @PutMapping("/batch/unpin")
    public void batchUnpinConversations(@RequestBody List<String> conversationIds) {
        conversationHistoryService.batchUnpinConversations(conversationIds);
    }
}
