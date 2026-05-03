package com.mytest.backend.conversation.controller;

import com.mytest.backend.conversation.dto.ConversationRenameRequest;
import com.mytest.backend.conversation.dto.ConversationSaveRequest;
import com.mytest.backend.conversation.dto.ConversationStatePatchRequest;
import com.mytest.backend.conversation.service.ConversationHistoryService;
import com.mytest.backend.conversation.vo.ConversationHistoryResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/conversations/histories")
@RequiredArgsConstructor
@Validated
@CrossOrigin(origins = "*")
public class ConversationHistoryController {

    private final ConversationHistoryService conversationHistoryService;

    @GetMapping("/page")
    public Page<ConversationHistoryResponse> pageConversations(
            @RequestParam @NotBlank String staffId,
            @RequestParam(required = false) String search,
            @PageableDefault(
                    size = 20,
                    sort = {"isPinned", "pinnedAt", "updatedAt"},
                    direction = Sort.Direction.DESC
            ) Pageable pageable) {
        return conversationHistoryService.pageConversations(staffId, search, pageable);
    }

    @GetMapping("/{id}")
    public ConversationHistoryResponse getConversationDetail(
            @PathVariable @NotBlank String id,
            @RequestParam @NotBlank String staffId) {
        return conversationHistoryService.getConversationDetail(id, staffId);
    }

    @PostMapping
    public ConversationHistoryResponse saveConversation(@Valid @RequestBody ConversationSaveRequest request) {
        return conversationHistoryService.saveConversation(request);
    }

    @PatchMapping("/{id}/state")
    public ConversationHistoryResponse patchConversationState(
            @PathVariable @NotBlank String id,
            @Valid @RequestBody ConversationStatePatchRequest request) {
        return conversationHistoryService.patchConversationState(id, request);
    }

    @PutMapping("/{id}/rename")
    public ConversationHistoryResponse renameConversation(
            @PathVariable @NotBlank String id,
            @Valid @RequestBody ConversationRenameRequest request) {
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
