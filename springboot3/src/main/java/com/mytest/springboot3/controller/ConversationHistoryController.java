package com.mytest.springboot3.controller;

import com.mytest.springboot3.dto.ConversationMigrationRequest;
import com.mytest.springboot3.dto.ConversationRenameRequest;
import com.mytest.springboot3.dto.ConversationSaveRequest;
import com.mytest.springboot3.service.ConversationHistoryService;
import com.mytest.springboot3.vo.ConversationHistoryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/conversations/histories")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ConversationHistoryController {

    private final ConversationHistoryService conversationHistoryService;

    @GetMapping("/page")
    public Mono<Page<ConversationHistoryResponse>> pageConversations(
            @RequestParam String staffId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt"));
        return conversationHistoryService.pageConversations(staffId, search, pageable);
    }

    @GetMapping("/{id}")
    public Mono<ConversationHistoryResponse> getConversationDetail(
            @PathVariable String id,
            @RequestParam String staffId) {
        return conversationHistoryService.getConversationDetail(id, staffId);
    }

    @PostMapping
    public Mono<ConversationHistoryResponse> saveConversation(@RequestBody ConversationSaveRequest request) {
        return conversationHistoryService.saveConversation(request);
    }

    @PutMapping("/{id}/rename")
    public Mono<ConversationHistoryResponse> renameConversation(
            @PathVariable String id,
            @RequestBody ConversationRenameRequest request) {
        return conversationHistoryService.renameConversation(id, request.getTitle());
    }

    @DeleteMapping("/batch")
    public Mono<Void> batchDeleteConversations(@RequestBody List<String> conversationIds) {
        return conversationHistoryService.batchDeleteConversations(conversationIds).then();
    }

    @PutMapping("/batch/pin")
    public Mono<Void> batchPinConversations(@RequestBody List<String> conversationIds) {
        return conversationHistoryService.batchPinConversations(conversationIds).then();
    }

    @PutMapping("/batch/unpin")
    public Mono<Void> batchUnpinConversations(@RequestBody List<String> conversationIds) {
        return conversationHistoryService.batchUnpinConversations(conversationIds).then();
    }

}
