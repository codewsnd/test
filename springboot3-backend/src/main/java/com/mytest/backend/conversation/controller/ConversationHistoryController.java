package com.mytest.backend.conversation.controller;

import com.mytest.backend.conversation.dto.ConversationRenameRequest;
import com.mytest.backend.conversation.dto.ConversationSaveRequest;
import com.mytest.backend.conversation.dto.ConversationStatePatchRequest;
import com.mytest.backend.conversation.service.ConversationHistoryService;
import com.mytest.backend.conversation.util.JwtTokenUtil;
import com.mytest.backend.conversation.vo.ConversationHistoryResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.mytest.backend.constants.CommonConstants.X_E2E_TRUST_TOKEN;

@RestController
@RequestMapping("/conversations/histories")
@RequiredArgsConstructor
@Validated
@CrossOrigin(origins = "*")
public class ConversationHistoryController {

    private final ConversationHistoryService conversationHistoryService;

    @GetMapping
    public Page<ConversationHistoryResponse> pageConversations(
            @RequestHeader(X_E2E_TRUST_TOKEN) String jwtToken,
            @RequestParam(required = false) String search,
            @PageableDefault(
                    sort = {"isPinned", "pinnedAt", "updatedAt"},
                    direction = Sort.Direction.DESC
            ) Pageable pageable) {
        return conversationHistoryService.pageConversations(JwtTokenUtil.getStaffId(jwtToken), search, pageable);
    }

    @GetMapping("/{id}")
    public ConversationHistoryResponse getConversationDetail(
            @PathVariable @NotBlank String id,
            @RequestHeader(X_E2E_TRUST_TOKEN) String jwtToken) {
        return conversationHistoryService.getConversationDetail(id, JwtTokenUtil.getStaffId(jwtToken));
    }

    @PostMapping
    public ConversationHistoryResponse saveConversation(
            @RequestHeader(X_E2E_TRUST_TOKEN) String jwtToken,
            @Valid @RequestBody ConversationSaveRequest request) {
        request.setStaffId(JwtTokenUtil.getStaffId(jwtToken));
        return conversationHistoryService.saveConversation(request);
    }

    @PatchMapping("/{id}/state")
    public ConversationHistoryResponse patchConversationState(
            @PathVariable @NotBlank String id,
            @RequestHeader(X_E2E_TRUST_TOKEN) String jwtToken,
            @Valid @RequestBody ConversationStatePatchRequest request) {
        request.setStaffId(JwtTokenUtil.getStaffId(jwtToken));
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
